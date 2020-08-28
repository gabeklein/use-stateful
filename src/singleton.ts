import { Controller } from './controller';
import { defineAtNeed, Issues } from './util';

const Oops = Issues({
  ContextNotAllowed: (name) =>
    `Controller ${name} is tagged as global. Context API does not apply.`,

  DestroyNotActive: (name) =>
    `${name}.destory() was called on an instance which is not active.` +
    `This is an antipattern and may caused unexpected behavior.`,

  CantAttach: (parent, child) =>
    `Singleton '${parent}' attempted to attach '${child}'.` +
    `This is not possible because '${child}' is not also a singleton.`,

  AlreadyExists: (type) =>
    `Shared instance of ${type} already exists!` +
    `'${type}.use(...)' may only be mounted once at any one time.`,

  DoesNotExist: (name) =>
    `Tried to access singleton ${name} but one does not exist! Did you forget to initialize?\n` +
    `Call ${name}.create() before attempting to access, or consider using ${name}.use() here instead.`
})

export class Singleton extends Controller {
  destroy(){
    super.destroy();

    const meta = this.constructor as typeof Singleton;

    if(this === meta.current)
      meta.current = undefined;
    else
      Oops.DestroyNotActive(meta.name).warn();
  }

  attach(key: string, type: typeof Controller){
    if(type.context)
      throw Oops.CantAttach(this.constructor.name, type.name)
    else 
      defineAtNeed(this, key, () => type.find());
  }

  static current?: Singleton = undefined;

  static find(){
    const instance = this.current;

    if(!instance)
      throw Oops.DoesNotExist(this.name);

    return instance as Controller;
  }

  static create<T extends Class>(
    this: T,
    args: any[], 
    prepare?: (self: any) => void){

    const Type = this as unknown as typeof Singleton;
    let instance = Type.current as InstanceType<T>;

    if(instance)
      throw Oops.AlreadyExists(this.name);

    instance = super.create(args, prepare) as any;
    Type.current = instance;
    
    return instance;
  }
  
  static delete(instance?: Singleton){
    const constructor = instance 
      ? instance.constructor as typeof Singleton
      : this;

    if(!instance)
      instance = this.current;
    else 
      
    if(!instance)
      return;

    delete constructor.current;
  }

  static get context(){
    return undefined;
  }

  static get Provider(): never {
    throw Oops.ContextNotAllowed(this.name);
  }
}