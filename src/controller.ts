import { lifecycleEvents } from './lifecycle';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import {
  assign,
  createEffect,
  debounce,
  fn,
  keys,
  Recursive,
  selectRecursive
} from './util';

import Oops from './issues';

export const DISPATCH = Symbol("controller");

type Query = (select: Recursive<{}>) => void;

export type Controllable = {
  [DISPATCH]: Controller
}

export class Controller extends Observer {
  static key = DISPATCH;

  static get(from: Controllable){
    let dispatch = from[DISPATCH];

    if(!dispatch.active)
      dispatch.start();

    return dispatch;
  }

  active?: boolean;

  constructor(subject: Controllable){
    super(subject);

    this.requestUpdate(() => {
      this.active = true;
    })
  }

  protected defer(fn: () => Callback){
    if(this.active)
      return fn();

    let release: Callback;
    this.requestUpdate(() => release = fn());
    return () => release();
  }

  protected select(
    using: string | Iterable<string> | Query){

    if(typeof using == "string")
      return [ using ];

    if(fn(using))
      return selectRecursive(using, 
        keys(this.state).concat(lifecycleEvents)
      );

    return Array.from(using);
  }

  public watch(
    target: string | Iterable<string> | Query,
    handler: any,
    squash?: boolean,
    once?: boolean){

    return this.defer(() => 
      super.watch(
        this.select(target),
        handler, squash, once
      )
    );
  }

  public on = (
    select: string | Iterable<string> | Query,
    listener: UpdateCallback<any, any>,
    squash?: boolean,
    once?: boolean) => {

    return this.watch(select, listener, squash, once)
  }

  public once = (
    select: string | Iterable<string> | Query,
    listener?: UpdateCallback<any, any>,
    squash?: boolean) => {

    if(listener)
      return this.watch(select, listener, squash, true);
    else 
      return new Promise<void>(resolve => {
        this.watch(select, resolve, true, true);
      });
  }

  public effect = (
    callback: EffectCallback<any>,
    select?: string[] | Query) => {
    
    let { subject } = this;

    const effect = createEffect(callback);
    const invoke = debounce(() => effect(subject));

    if(select)
      return this.watch(select, invoke, true);

    const subscribe = () => {
      const sub = new Subscriber(subject, invoke);
      effect(subject = sub.proxy);
      sub.listen();
      return () => sub.release();
    }

    return this.defer(subscribe);
  }

  public import = (
    from: BunchOf<any>,
    select?: Iterable<string> | Query) => {

    const selected = select
      ? this.select(select)
      : keys(this.state);

    for(const key of selected)
      if(key in from)
        (this.subject as any)[key] = from[key];
  }

  public export = (
    select?: Iterable<string> | Query) => {

    if(!select)
      return assign({}, this.state);

    const data = {} as BunchOf<any>;

    for(const key of this.select(select))
      data[key] = (this.subject as any)[key];

    return data;
  }

  public update = (
    select: string | string[] | Query) => {

    for(const key of this.select(select))
      super.update(key);
  }

  public requestUpdate = (
    argument?: RequestCallback | boolean) => {

    const { pending, waiting } = this;

    if(fn(argument))
      waiting.push(argument)
    else if(!pending === argument)
      return Promise.reject(Oops.StrictUpdate())
    else if(pending)
      return new Promise(cb => waiting.push(cb));
    else
      return Promise.resolve(false);
  }
}