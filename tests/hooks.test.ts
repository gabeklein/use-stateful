import { Model, Singleton, renderHook } from './adapter';

const opts = { timeout: 100 };

describe("tap", () => {
  class Parent extends Singleton {
    value = "foo";
    child = new Child();
  }
  
  class Child extends Model {
    value = "foo"
    grandchild = new GrandChild();
  }
  
  class GrandChild extends Model {
    value = "bar"
  }

  let singleton!: Parent;

  beforeEach(() => {
    if(Parent.current)
      singleton.destroy();

    singleton = Parent.create();
  });
  
  it('access subvalue directly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => {
      return Parent.tap("value");
    })
  
    expect(result.current).toBe("foo");
  
    singleton.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
  
  it('select subvalue directly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => {
      return Parent.tap(x => x.value);
    });
  
    expect(result.current).toBe("foo");

    singleton.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
  
  it('access child controller', async () => {
    const { result, waitForNextUpdate } = renderHook(() => {
      return Parent.tap("child");
    })
  
    expect(result.current.value).toBe("foo");
  
    result.current.value = "bar"
  
    await waitForNextUpdate(opts);
  
    expect(result.current.value).toBe("bar");
  
    singleton.child = new Child();
  
    await waitForNextUpdate(opts);

    expect(result.current.value).toBe("foo");
  })
  
  it.todo('access nested controllers')
})

describe("meta", () => {
  class Child extends Model {
    value = "foo";
  }
  
  class Parent extends Model {
    static value = "foo";
    static child = new Child();
  }

  beforeEach(() => Parent.value = "foo")
  
  it('will track static values', async () => {
    const { result, waitForNextUpdate } = renderHook(() => {
      const meta = Parent.meta();
      return meta.value;
    });

    expect(result.current).toBe("foo");

    Parent.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
  
  it.skip('will track specific values', async () => {
    const { result, waitForNextUpdate } = renderHook(() => {
      const meta = Parent.meta(x => x.value);
      return meta;
    });

    expect(result.current).toBe("foo");

    Parent.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
  
  it('will track child controller values', async () => {
    const { result: { current }, waitForNextUpdate } = renderHook(() => {
      const meta = Parent.meta();
      void meta.child.value;
      return meta;
    });
  
    expect(current.child.value).toBe("foo");
  
    // Will refresh on sub-value change.
    current.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("bar");
  
    // Will refresh on repalcement.
    current.child = new Child();
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("foo");
  
    // Fresh subscription does still work.
    current.child.value = "bar";
    await waitForNextUpdate(opts);
    expect(current.child.value).toBe("bar");
  })
})