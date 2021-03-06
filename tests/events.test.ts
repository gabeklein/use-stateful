import { Oops } from "../src/util";
import { Model } from "./adapter";

describe("on", () => {
  class Subject extends Model {
    seconds = 0;
    hours = 0;
  
    get minutes(){
      return Math.floor(this.seconds / 60)
    }
  }
  
  it('will watch for updated value', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("seconds", callback);

    state.seconds = 30;
    await state.requestUpdate();
  
    expect(callback).toBeCalledWith(30, "seconds");
  })
  
  it('will watch for computed value', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("minutes", callback);

    state.seconds = 60;
    await state.requestUpdate();
  
    expect(callback).toBeCalledWith(1, "minutes");
  })

  it('will compute pending value early', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on("minutes", callback);

    state.seconds = 60;
    await state.requestUpdate();
  
    expect(callback).toBeCalledWith(1, "minutes");
  })

  it('will watch values with selector', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    state.on(x => x.seconds, callback);

    state.seconds = 30;
    await state.requestUpdate();
  
    expect(callback).toBeCalledWith(30, "seconds");
  })

  it('will watch multiple keys', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(x => x.seconds.hours, callback);

    state.seconds = 30;
    await state.requestUpdate();

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith(30, "seconds");

    state.hours = 2;
    await state.requestUpdate();

    expect(callback).toBeCalledWith(2, "hours");
  })

  it('will call for all simultaneous', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(x => x.minutes.seconds, callback);

    state.seconds = 60;
    await state.requestUpdate();

    expect(callback).toBeCalledWith(60, "seconds");
    expect(callback).toBeCalledWith(1, "minutes");
  })

  it('will call once for simultaneous in squash-mode', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.on(x => x.seconds.minutes, callback, true);

    state.seconds = 60;
    await state.requestUpdate();

    expect(callback).toBeCalledWith(["seconds", "minutes"]);
  })
})

describe("once", () => {
  class Subject extends Model {
    seconds = 0;
    hours = 0;
  
    get minutes(){
      return Math.floor(this.seconds / 60)
    }
  }

  it('will ignore subsequent events', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.once(x => x.seconds, callback);

    state.seconds = 30;
    await state.requestUpdate();

    expect(callback).toBeCalledWith(30, "seconds");

    state.seconds = 45;
    await state.requestUpdate();

    expect(callback).not.toBeCalledWith(45, "seconds");
  })

  it('will return promise with update keys', async () => {
    const state = Subject.create();
    const pending = state.once(x => x.seconds);

    state.seconds = 30;
  
    await expect(pending).resolves.toMatchObject(["seconds"]);
  })

  it('will call for all simultaneous', async () => {
    const state = Subject.create();
    const callback = jest.fn();

    state.once(x => x.seconds.minutes, callback);

    state.seconds = 60;
    await state.requestUpdate();

    expect(callback).toBeCalledWith(60, "seconds");
    expect(callback).toBeCalledWith(1, "minutes");

    state.seconds = 61;
    await state.requestUpdate();

    expect(callback).not.toBeCalledWith(61, "seconds");
  })
})

describe("effect", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;
  
    get value4(){
      return this.value3 + 1;
    }
  }

  it('will watch values', async () => {
    const state = TestValues.create();
    const mock = jest.fn();
  
    state.effect(mock, [
      "value1",
      "value2",
      "value3",
      "value4",
    ]);
  
    state.value1 = 2;

    // wait for update event, thus queue flushed
    await state.requestUpdate()
    
    state.value2 = 3;
    state.value3 = 4;

    // wait for update event to flush queue
    await state.requestUpdate()
    
    // expect two syncronous groups of updates.
    expect(mock).toBeCalledTimes(2)
  })

  it('will watch values with selector', async () => {
    const state = TestValues.create();
    const mock = jest.fn();
  
    state.effect(mock,
      $ => $.value1.value2.value3.value4
    );
  
    state.value1 = 2;
    state.value2 = 3;

    await state.requestUpdate();

    state.value3 = 4;

    // expect value4, which relies on 3.
    await state.requestUpdate();
    
    expect(mock).toBeCalledTimes(2);
  })

  it('will watch values with subscriber', async () => {
    const state = TestValues.create();
    let invokedNTimes = 0;
  
    state.effect(self => {
      // destructure values to indicate access.
      const { value1, value2, value3 } = self;
      void value1, value2, value3;
      invokedNTimes++;
    });
  
    state.value1 = 2;
    await state.requestUpdate();

    state.value2 = 3;
    await state.requestUpdate();

    state.value2 = 4;
    state.value3 = 4;
    await state.requestUpdate();
  
    /**
     * must invoke once to detect subscription
     * 
     * invokes three more times:
     * - value 1
     * - value 2
     * - value 2 & 3 (squashed)
     */
    expect(invokedNTimes).toBe(4);
  })

  it("will throw if effect returns non-function", () => {
    const state = TestValues.create();
    const expected = Oops.BadEffectCallback();
    const attempt = () => {
      // @ts-ignore
      state.effect(() => "foobar");
    }

    expect(attempt).toThrowError(expected);
  })

  it("will not throw if effect returns promise", () => {
    const state = TestValues.create();
    const attempt = () => {
      state.effect(async () => {});
    }

    expect(attempt).not.toThrowError();
  })
});

describe("will accept before ready", () => {
  class TestValues extends Model {
    value1 = 1;
    value2 = 2;
  
    get value3(){
      return this.value2 + 1;
    }
  }

  it('on method', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on("value1", mock);
      }
    }

    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.requestUpdate();

    expect(mock).toBeCalled();
  })

  it('on method with getter', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on("value3", mock);
      }
    }
    
    const mock = jest.fn();
    const state = Test.create();

    state.value2++;
    await state.requestUpdate();

    expect(mock).toBeCalled();
  })

  it('on method with selector', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.on(x => x.value1, mock);
      }
    }
    
    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.requestUpdate();

    expect(mock).toBeCalled();
  })

  it('on method using cancel', async () => {
    class Test extends TestValues {
      cancel = this.on("value1", mock);
    }

    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.requestUpdate(true);
    expect(mock).toBeCalledTimes(1);

    state.value1++;
    await state.requestUpdate(true);
    expect(mock).toBeCalledTimes(2);

    state.cancel();

    state.value1++;
    await state.requestUpdate(true);
    expect(mock).toBeCalledTimes(2);
  })

  it('effect method', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.effect(mock, ["value1", "value3"]);
      }
    }

    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.requestUpdate();

    expect(mock).toBeCalled();

    state.value2++;
    await state.requestUpdate();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(2);
  })

  it('effect method with selector', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        // @ts-ignore
        this.effect(mock, x => x.value1.value3);
      }
    }

    const mock = jest.fn();
    const state = Test.create();

    state.value1++;
    await state.requestUpdate();

    expect(mock).toBeCalled();

    state.value2++;
    await state.requestUpdate();

    // expect pre-existing listener to hit
    expect(mock).toBeCalledTimes(2);
  })

  it('effect method with subscriber', async () => {
    class Test extends TestValues {
      constructor(){
        super();
        this.effect(this.test);
      }

      test(){
        void this.value1;
        void this.value3;
        mock();
      }
    }

    const mock = jest.fn();
    const state = Test.create();

    // runs immediately to aquire subscription
    expect(mock).toBeCalled();

    state.value1++;
    await state.requestUpdate();

    expect(mock).toBeCalledTimes(2);

    state.value2++;
    await state.requestUpdate();

    expect(mock).toBeCalledTimes(3);
  })
});