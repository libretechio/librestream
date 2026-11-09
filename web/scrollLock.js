const locks = new WeakMap();

export function lockBodyScroll(body = document.body) {
  let state = locks.get(body);
  if (!state) {
    state = { count: 0, previous: body.style.overflow };
    locks.set(body, state);
    body.style.overflow = 'hidden';
  }
  state.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count -= 1;
    if (!state.count) {
      body.style.overflow = state.previous;
      locks.delete(body);
    }
  };
}
