import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const WATCHLIST_KEY = 'stockwatcher.watchlist.symbols.v1';
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'TSLA'];

@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly symbolsSubject = new BehaviorSubject<string[]>(this.read());

  get symbols$() {
    return this.symbolsSubject.asObservable();
  }

  getSymbols(): string[] {
    return this.symbolsSubject.value;
  }

  addSymbol(symbol: string): void {
    const s = symbol.toUpperCase();
    const curr = new Set(this.symbolsSubject.value);
    if (!curr.has(s)) {
      curr.add(s);
      this.save([...curr]);
    }
  }

  removeSymbol(symbol: string): void {
    const s = symbol.toUpperCase();
    const next = this.symbolsSubject.value.filter(x => x !== s);
    this.save(next);
  }

  private save(symbols: string[]) {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols));
    this.symbolsSubject.next(symbols);
  }

  private read(): string[] {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (!raw) return DEFAULT_WATCHLIST.slice();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
        return parsed as string[];
      }
      return DEFAULT_WATCHLIST.slice();
    } catch {
      return DEFAULT_WATCHLIST.slice();
    }
  }
}
