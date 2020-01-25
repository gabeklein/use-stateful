import {
    FunctionComponentElement,
    ProviderProps,
    Context,
    Component,
    FunctionComponent,
} from 'react';

type Class = new (...args: any) => any;
type Expects<A extends any[]> = new(...args: A) => any
type BunchOf<T> = { [key: string]: T }
type BooleanValuesOf<T> = { [K in keyof T]: T[K] extends boolean | undefined ? K : never }
type KeyOfBooleanValueIn<T> = keyof Pick<T, BooleanValuesOf<T>[keyof T]>;

declare function use<I, A extends any[]> (define: new (...args: A) => I, ...args: A): Controller & I;
declare function use<I, A extends any[]> (init: (...args: A) => I, ...args: A): Controller & I;
declare function use<I> (controller: Controller): Controller;
declare function use<I> (init: I): Controller & I;

declare function get<T extends Class> (type: T): InstanceType<T>;

interface Subscriber<T> {
    on(...properties: string[]): Subscriber<T> | T;
    not(...properties: string[]): Subscriber<T> | T;
    only(...properties: string[]): T;
    once(): T;
    except: never;
}

declare class Controller {
    set: this;
    get: this;
    hold: boolean;

    refresh(...keys: string[]): void;
    export(): { [P in keyof this]: this[P] };
    add(key: string, initial?: any, bootup?: true): boolean;
    toggle(key: KeyOfBooleanValueIn<this>): boolean;

    didInit?(): void;
    willDestroy(callback?: () => void): void;

    willRender?(...args: any[]): void;
    willMount?(...args: any[]): void;
    willUpdate?(...args: any[]): void;
    didMount?(...args: any[]): void;
    willUnmount?(...args: any[]): void;

    elementWillRender?(...args: any[]): void;
    elementWillMount?(...args: any[]): void;
    elementWillUpdate?(...args: any[]): void;
    elementDidMount?(...args: any[]): void;
    elementWillUnmount?(...args: any[]): void;

    componentWillRender?(...args: any[]): void;
    componentWillMount?(...args: any[]): void;
    componentWillUpdate?(...args: any[]): void;
    componentDidMount?(...args: any[]): void;
    componentWillUnmount?(...args: any[]): void;

    on(): this;
    once(): this
    only(): this;
    not(): this;

    tap(): this;
    tap<K extends keyof this>(key?: K): this[K];

    sub(...args: any[]): this & Subscriber<this>;
    
    get Provider(): FunctionComponentElement<ProviderProps<this>>
    get Value(): FunctionComponent<{ of: string }>

    static get Provider(): FunctionComponentElement<any>;
    static makeGlobal<T extends Class>(this: T): InstanceType<T>;
    static singleton<T extends Class>(this: T): Singleton<InstanceType<T>>;
    
    static use <A extends any[], T extends Expects<A>> (this: T, ...args: A): InstanceType<T> & Subscriber<InstanceType<T>>;
    
    static sub <T extends Class> (this: T, ...args: any[]): InstanceType<T> & Subscriber<InstanceType<T>>;

    static get <T extends Class> (this: T): InstanceType<T>;
    static get <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];

    static has <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): Exclude<I[K], undefined>;

    static tap <T extends Class> (this: T): InstanceType<T> & Subscriber<InstanceType<T>>;
    static tap <T extends Class, I extends InstanceType<T>, K extends keyof I> (this: T, key: K): I[K];

    static hoc <T extends Class> (this: T, fc: FunctionComponent<InstanceType<T>>): Component<any>;
    static context <T extends Class> (this: T): Context<InstanceType<T>>;
}

interface Singleton<T extends Controller>{
    get (): T;
    get <K extends keyof T> (key: K): T[K];
    has <K extends keyof T> (key: K): Exclude<T[K], undefined>;
    tap <K extends keyof T> (key: K): T[K];
    tap (this: T): T & Subscriber<T>;
    sub(...args: any[]): T & Subscriber<T>;
}

interface MultiProviderProps {
    using: Controller[]
}

declare const MultiProvider: FunctionComponentElement<MultiProviderProps>

export { 
    use,
    get,
    Controller,
    Controller as default,
    MultiProvider as Provider
}