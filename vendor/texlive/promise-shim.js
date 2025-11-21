(function(global) {
  if (global.promise) {
    return;
  }

  function LegacyPromise() {
    let resolveFn;
    let rejectFn;
    const inner = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    inner.done = (value) => resolveFn(value);
    inner.fail = (error) => rejectFn(error);
    return inner;
  }

  const chain = (fns) => {
    if (!Array.isArray(fns)) {
      return Promise.resolve();
    }
    return fns.reduce((prev, fn) => {
      if (typeof fn !== 'function') {
        return prev;
      }
      return prev.then(() => fn());
    }, Promise.resolve());
  };

  global.promise = {
    Promise: LegacyPromise,
    chain
  };
})(self);
