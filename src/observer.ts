import { Model } from './model';
import { Subscriber } from './subscriber';
import {
  alias,
  defineProperty,
  entriesIn,
  fn,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  insertAfter
} from './util';

import Oops from './issues';

export interface GetterInfo {
  key: string;
  parent: Observer;
  priority: number;
}

type Init = (key: string, on: Observer) => void;

const ComputedInfo = new WeakMap<Function, GetterInfo>();
const ComputedInit = new WeakSet<Function>();
const Pending = new WeakSet<Init>();

function runEarlyIfComputed(on: {}, key: string){
  type Initialize = (early?: boolean) => void;

  const desc = getOwnPropertyDescriptor(on, key);
  const getter = desc && desc.get;

  if(ComputedInit.has(getter!))
    (getter as Initialize)(true);
}

export function metaData(x: Function): GetterInfo;
export function metaData(x: Function, set: GetterInfo): typeof ComputedInfo;
export function metaData(x: Function, set?: GetterInfo){
  if(set)
    return ComputedInfo.set(x, set);
  else
    return ComputedInfo.get(x);
}

export class Observer {
  protected getters = new Map<string, Callback>();
  protected waiting = [] as RequestCallback[];

  public state = {} as BunchOf<any>;
  public followers = new Set<BunchOf<RequestCallback>>();
  public watched = new Set<string>();

  public pending?: (key: string) => void;

  static define(fn: Init){
    Pending.add(fn);
    return fn as any;
  }

  constructor(
    public subject: {}){
  }

  protected start(){
    for(const [key, { value, enumerable }] of entriesIn(this.subject))
      if(Pending.has(value))
        value(key, this);
      else if(enumerable && !fn(value) || /^[A-Z]/.test(key))
        this.monitorValue(key, value);

    this.initComputed();
    this.reset([]);
  }

  protected prepareComputed(){
    for(
      let scan = this.subject;
      scan !== Model && scan.constructor !== Model;
      scan = getPrototypeOf(scan)){

      for(let [key, { get, set }] of entriesIn(scan)){
        if(!get || this.getters.has(key))
          continue;

        if(!set)
          set = (value: any) => {
            this.getters.delete(key);
            this.assign(key, {
              value,
              configurable: true,
              writable: true
            });
          }

        alias(get, `run ${key}`);

        this.getters.set(key, get);
        this.assign(key, { get, set, configurable: true });
      }
    }
  }

  protected initComputed(){
    const expected: Callback[] = [];

    for(const [key, compute] of this.getters){
      if(key in this.state)
        continue;

      const init =
        this.monitorComputed(key, compute);

      if(init)
        expected.push(init);
    }

    for(const init of expected)
      init();
  }

  public assign(key: string, desc: PropertyDescriptor){
    this.watched.add(key);
    defineProperty(this.subject, key, { enumerable: true, ...desc });
  }

  public monitorValue(
    key: string,
    initial: any,
    effect?: (value: any, callee?: any) => void){

    if(initial !== undefined)
      this.state[key] = initial;

    this.assign(key, {
      get: this.getter(key),
      set: this.setter(key, effect)
    });
  }

  private monitorComputed(
    key: string, compute: () => any){

    const self = this;
    const { state, subject } = this;
    const info = { key, parent: this, priority: 1 };

    function refresh(){
      let next;

      try {
        next = compute.call(subject);
      }
      catch(err){
        Oops.ComputeFailed(subject.constructor.name, key, false).warn();
        throw err;
      }

      if(next !== state[key]){
        state[key] = next;
        self.emit(key);
      }
    }

    function initial(early?: boolean){
      const sub = new Subscriber(subject, refresh, info);

      try {
        defineProperty(sub.proxy, key, { value: undefined });

        return state[key] = compute.call(sub.proxy);
      }
      catch(e){
        Oops.ComputeFailed(subject.constructor.name, key, true).warn();

        if(early)
          Oops.ComputedEarly(key).warn();

        throw e;
      }
      finally {
        sub.listen();

        for(const key in sub.following){
          const compute = self.getters.get(key);

          if(!compute)
            continue;

          const { priority } = metaData(compute);

          if(info.priority <= priority)
            info.priority = priority + 1;
        }

        self.assign(key, {
          get: self.getter(key),
          set: Oops.AssignToGetter(key).warn
        })
      }
    }

    alias(initial, `new ${key}`);
    alias(refresh, `try ${key}`);

    metaData(compute, info);
    self.watched.add(key);
    ComputedInit.add(initial);

    for(const sub of self.followers)
      if(key in sub)
        return initial;

    defineProperty(state, key, {
      configurable: true,
      get: initial,
      set: to => defineProperty(state, key, {
        writable: true,
        value: to
      })
    })

    this.assign(key, {
      get: initial,
      set: Oops.AssignToGetter(key).warn
    })
  }

  public getter(key: string){
    return alias(() => this.state[key], `get ${key}`);
  }

  public setter(
    key: string,
    effect?: (next: any, callee?: any) => void){

    const assigned = (value: any) => {
      if(this.state[key] == value)
        return;

      this.state[key] = value;

      if(effect)
        effect(value, this.subject);

      this.emit(key);
    }
      
    return alias(assigned, `set ${key}`);
  }

  public watch(
    target: string | string[],
    handler: (value: any, key: string) => void,
    once?: boolean){

    const keys = ([] as string[]).concat(target);

    const callback = (frame: Iterable<string>) => {
      for(const key of frame)
        if(keys.includes(key))
          handler.call(this.subject, this.state[key], key);
    }

    return this.addListener(keys, callback, once);
  }

  public addListener(
    keys: Iterable<string>,
    callback: RequestCallback,
    once?: boolean){

    const remove = () => { this.followers.delete(follow) };
    const handler = once ? (k: string[]) => { remove(); callback(k) } : callback;
    const follow: BunchOf<RequestCallback> = {};

    for(const key of keys){
      runEarlyIfComputed(this.subject, key);
      follow[key] = handler;
    }

    this.followers.add(follow);

    return remove;
  }

  public emit(key: string){
    (this.pending || this.sync())(key);
  }

  private reset(frame: string[]){
    this.waiting.splice(0).forEach(x => x(frame));
  }

  private sync(){
    const self = this;
    const effects = new Set<RequestCallback>();
    const handled = new Set<string>();
    const pending = [] as Callback[];

    function add(key: string){
      if(handled.has(key))
        return;

      handled.add(key);

      for(const sub of self.followers)
        if(key in sub)
          include(sub[key]);
    }

    function include(request: RequestCallback){
      const target = metaData(request);

      if(target && target.parent == self)
        insertAfter(pending, request,
          sib => target.priority > metaData(sib).priority
        )
      else
        effects.add(request);
    }

    function notify(){
      while(pending.length){
        const compute = pending.shift()!;
        const { key } = metaData(compute);

        if(!handled.has(key))
          compute();
      }

      const frame = Array.from(handled);

      effects.forEach(x => x(frame));

      self.pending = undefined;
      self.reset(frame);
    }

    setTimeout(notify, 0);
    return this.pending = add;
  }
}