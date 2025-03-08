export class Queue<T> {
  private _items: T[] = [];

  enqueue(item: T): void {
    this._items.push(item);
  }

  dequeue(): T | undefined {
    return this._items.shift();
  }

  peek(): T | undefined {
    return this._items[0];
  }

  items(): T[] {
    return [...this._items];
  }

  size(): number {
    return this._items.length;
  }
}