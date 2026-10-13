"use client";

// The landing intro hands off to the hero: the hero timeline waits for this.
let done = false;
const subs = new Set<() => void>();

export function whenIntroDone(cb: () => void) {
  if (done) {
    cb();
    return () => {};
  }
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function finishIntro() {
  if (done) return;
  done = true;
  subs.forEach((f) => f());
  subs.clear();
}
