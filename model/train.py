"""Fine-tunes EfficientNet-B2 on Food-101 and exports it to ONNX for the Node backend.

    python model/train.py --data path/to/datasets      (folder that contains food-101/)
    python model/train.py --data ... --resume          (carry on from best.pt and curve.json)
    python model/train.py --data ... --export          (re-export best.pt only)

5% of the training split is held back to pick the best epoch; the official test split is
scored once, at the end, and written to model/metrics.json with the per-epoch curve.
"""
import argparse
import json
import pathlib
import time
import warnings

import torch
from torch import nn
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, models, transforms

HERE = pathlib.Path(__file__).resolve().parent
SIZE = 260
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]


def loaders(root, batch):
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(SIZE, scale=(0.35, 1)), transforms.RandomHorizontalFlip(),
        transforms.TrivialAugmentWide(), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    eval_tf = transforms.Compose([
        transforms.Resize(int(SIZE * 1.12)), transforms.CenterCrop(SIZE), transforms.ToTensor(), transforms.Normalize(MEAN, STD)])
    full_train = datasets.Food101(root, split="train", transform=train_tf)
    full_eval = datasets.Food101(root, split="train", transform=eval_tf)
    test = datasets.Food101(root, split="test", transform=eval_tf)
    order = torch.randperm(len(full_train), generator=torch.Generator().manual_seed(0)).tolist()
    cut = len(order) // 20
    kw = dict(batch_size=batch, num_workers=4, pin_memory=True, persistent_workers=True)
    return (DataLoader(Subset(full_train, order[cut:]), shuffle=True, drop_last=True, **kw),
            DataLoader(Subset(full_eval, order[:cut]), **kw),
            DataLoader(test, **kw), full_train.classes)


@torch.no_grad()
def evaluate(model, loader, n_classes):
    model.eval()
    top1 = top5 = total = 0
    hits, seen = torch.zeros(n_classes), torch.zeros(n_classes)
    for x, y in loader:
        x, y = x.cuda(non_blocking=True), y.cuda(non_blocking=True)
        with torch.autocast("cuda", dtype=torch.float16):
            best = model(x).topk(5, dim=1).indices
        ok = best[:, 0] == y
        top1 += ok.sum().item()
        top5 += (best == y[:, None]).any(dim=1).sum().item()
        total += len(y)
        hits.index_add_(0, y.cpu(), ok.float().cpu())
        seen.index_add_(0, y.cpu(), torch.ones(len(y)))
    return top1 / total, top5 / total, (hits / seen.clamp(min=1)).tolist()


class WithSoftmax(nn.Module):
    def __init__(self, net):
        super().__init__()
        self.net = net

    def forward(self, x):
        return self.net(x).softmax(dim=1)


def export_onnx(model, classes):
    # eval() on the wrapper itself: the exporter restores the wrapper's mode to every
    # submodule afterwards, and a wrapper left in train mode turns dropout back on.
    export = WithSoftmax(model.float().cpu()).eval()
    out = HERE.parent / "backend/model/food101-effnetb2.onnx"
    out.parent.mkdir(exist_ok=True)
    dummy = torch.randn(1, 3, SIZE, SIZE)
    torch.onnx.export(export, dummy, out, input_names=["image"], output_names=["probs"],
                      dynamic_axes={"image": {0: "batch"}, "probs": {0: "batch"}}, opset_version=17, dynamo=False)
    (out.parent / "labels.json").write_text(json.dumps(classes))

    import onnxruntime as ort  # the exported graph must agree with PyTorch
    got = ort.InferenceSession(str(out)).run(None, {"image": dummy.numpy()})[0]
    with torch.no_grad():
        want = export(dummy).numpy()
    assert abs(got - want).max() < 1e-4, abs(got - want).max()
    print(f"exported {out.name} ({out.stat().st_size / 1e6:.1f} MB), matches PyTorch", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--export", action="store_true", help="only re-export best.pt to ONNX")
    args = ap.parse_args()
    torch.manual_seed(0)
    torch.backends.cudnn.benchmark = True

    train_dl, val_dl, test_dl, classes = loaders(args.data, args.batch)
    model = models.efficientnet_b2(weights=models.EfficientNet_B2_Weights.IMAGENET1K_V1)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(classes))
    if args.export:
        model.load_state_dict(torch.load(HERE / "best.pt", weights_only=True))
        return export_onnx(model, classes)
    model = model.cuda()  # not channels_last: its depthwise convs ran 4.6x slower here

    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.05)
    steps = args.epochs * len(train_dl)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1e-3, total_steps=steps, pct_start=1 / args.epochs)
    scaler = torch.amp.GradScaler()
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)

    curve, best = [], 0.0
    if args.resume:  # same schedule, picked up where it stopped; only AdamW's moments start over
        model.load_state_dict(torch.load(HERE / "best.pt", weights_only=True))
        curve = json.loads((HERE / "curve.json").read_text())
        best = max(c["valTop1"] for c in curve)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for _ in range(len(curve) * len(train_dl)):
                sched.step()
    for epoch in range(len(curve) + 1, args.epochs + 1):
        model.train()
        start, running = time.time(), 0.0
        for x, y in train_dl:
            x, y = x.cuda(non_blocking=True), y.cuda(non_blocking=True)
            with torch.autocast("cuda", dtype=torch.float16):
                loss = loss_fn(model(x), y)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            running += loss.item()
            if epoch == 1 and sched.last_epoch == 300:
                print(f"speed: {300 * args.batch / (time.time() - start):.0f} images/s", flush=True)
        val1, val5, _ = evaluate(model, val_dl, len(classes))
        curve.append({"epoch": epoch, "trainLoss": round(running / len(train_dl), 4), "valTop1": round(val1, 4), "valTop5": round(val5, 4)})
        (HERE / "curve.json").write_text(json.dumps(curve, indent=1))
        print(f"epoch {epoch}: loss {curve[-1]['trainLoss']}  val top-1 {val1:.4f}  top-5 {val5:.4f}  ({time.time() - start:.0f}s)", flush=True)
        if val1 > best:
            best = val1
            torch.save(model.state_dict(), HERE / "best.pt")

    model.load_state_dict(torch.load(HERE / "best.pt", weights_only=True))
    test1, test5, per_class = evaluate(model, test_dl, len(classes))
    ranked = sorted(zip(classes, per_class), key=lambda c: c[1])
    metrics = {"testTop1": round(test1, 4), "testTop5": round(test5, 4), "testImages": len(test_dl.dataset),
               "bestEpoch": max(curve, key=lambda c: c["valTop1"])["epoch"], "curve": curve,
               "hardest": [{"class": c, "top1": round(a, 4)} for c, a in ranked[:5]],
               "easiest": [{"class": c, "top1": round(a, 4)} for c, a in ranked[-5:]]}
    (HERE / "metrics.json").write_text(json.dumps(metrics, indent=1))
    print(f"TEST top-1 {test1:.4f}  top-5 {test5:.4f} on {len(test_dl.dataset)} images", flush=True)

    export_onnx(model, classes)

if __name__ == "__main__":
    main()
