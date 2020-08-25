import Controller, { trySubscribe } from "./adapter";

class Child extends Controller {
  value: string;

  constructor(value: string){
    super();
    this.value = value;
  }
}

class Parent extends Controller {
  static value = "foo";
  static child = new Child("foo");
}

test('tracks static values on meta', async () => {
  const { state, assertDidUpdate } = trySubscribe(
    () => Parent.meta(), ["value"]
  );

  expect(state.value).toBe("foo");

  state.value = "bar";

  await assertDidUpdate();
  expect(state.value).toBe("bar");
})

test('tracks nested values on meta', async () => {
  const { state, assertDidUpdate } = trySubscribe(
    () => Parent.meta(), ["child", "child.value"]
  );

  expect(state.child.value).toBe("foo");

  // Will refresh on sub-value change.
  state.child.value = "bar";
  await assertDidUpdate();
  expect(state.child.value).toBe("bar");

  // Will refresh on repalcement.
  state.child = new Child("foo");
  await assertDidUpdate();
  expect(state.child.value).toBe("foo");

  // Fresh subscription does still work.
  state.child.value = "bar";
  await assertDidUpdate();
  expect(state.child.value).toBe("bar");
})