```typescript
interface Pair<T = any> {
  value: T;
  done: boolean;
}

class TrainrunIterator<T = any> {
  #items: T[];
  #index: number;

  constructor(items: T[]) {
    this.#items = items;
    this.#index = 0;
  }

  public [Symbol.iterator](): Iterator<Pair<T>> {
    return this;
  }

  public next(): Pair<T> {
    if (this.#index >= this.#items.length) {
      return { value: undefined as T, done: true };
    }
    
    const item = this.#items[this.#index];
    this.#index++;
    
    return { value: item, done: false };
  }

  public hasNext(): boolean {
    return this.#index < this.#items.length;
  }
}

export { Pair, TrainrunIterator };
```