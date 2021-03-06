import { Model, subscribeTo, use } from './adapter';

describe("subscriber", () => {
  class Subject extends Model {
    value = 1;
    value2 = 2;
  }

  it('will detect change to properties accessed', async () => {
    const state = Subject.create();
    const update = subscribeTo(state, it => {
      void it.value;
      void it.value2;
    })

    state.value = 2;
    await update();

    state.value2 = 3;
    await update();
  })

  it('will ignore change to property not accessed', async () => {
    const state = Subject.create();
    const update = subscribeTo(state, it => {
      void it.value;
    })

    state.value = 2;
    await update();

    /**
     * we did not access value2 in above accessor,
     * subscriber assumes we don't care about updates
     * to this property, so it'l drop relevant events
     **/ 
    state.value2 = 3;
    await update(false);
  });

  it('will ignore properties accessed through get', async () => {
    const state = Subject.create();
    const update = subscribeTo(state, it => {
      void it.value;
      void it.get.value2;
    })

    state.value = 2;
    await update();

    state.value2 = 3;
    await update(false);
  })
})

describe("nested properties", () => {
  class Child extends Model {
    value = "foo"
  }
  
  class Parent extends Model {
    value = "foo";
    child = use(Child);
  }
  
  it('are be tracked recursively', async () => {
    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.value;
      void it.child.value;
    })

    expect(state.value).toBe("foo");
    expect(state.child.value).toBe("foo");
  
    state.value = "bar";
    await update();
  
    state.child.value = "bar";
    await update();
  })
  
  it('will update if intermediary does change', async () => {
    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.value;
      void it.child.value;
    })
  
    expect(state.child.value).toBe("foo");
  
    // Will refresh on sub-value change.
    state.child.value = "bar";
    await update();
    expect(state.child.value).toBe("bar");
  
    // Will refresh on repalcement.
    state.child = new Child();
    await update();
    expect(state.child.value).toBe("foo");
  
    // New subscription does still work.
    state.child.value = "bar";
    await update();
    expect(state.child.value).toBe("bar");
  })
  
  it('will reset if child becomes undefined', async () => {
    class Parent extends Model {
      value = "foo";
      child = use(Child);
    }

    const state = Parent.create();
    const update = subscribeTo(state, it => {
      void it.value;

      if(it.child)
        void it.child.value;
    })
  
    // Will refresh on sub-value change.
    state.child!.value = "bar";
    await update();
  
    // Will refresh on undefined.
    state.child = undefined as any;
    await update();
    expect(state.child).toBeUndefined();
  
    // Will refresh on repalcement.
    state.child = new Child();
    await update();
  
    // New subscription does still work.
    state.child.value = "bar";
    await update();
  })
})