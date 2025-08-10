import { Injectable, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Observable } from 'rxjs';

export interface QuoteUpdate {
  symbol: string;
  price: number;
  timestampUtc: string;
}

@Injectable({ providedIn: 'root' })
export class QuotesService implements OnDestroy {
  private hub?: HubConnection;
  private readonly quoteSubject = new BehaviorSubject<QuoteUpdate | null>(null);

  get quotes$(): Observable<QuoteUpdate | null> {
    return this.quoteSubject.asObservable();
  }

  async start(baseUrl: string): Promise<void> {
    if (this.hub) return;

    this.hub = new HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/quotes`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    this.hub.on('quote', (update: QuoteUpdate) => {
      this.quoteSubject.next(update);
    });

    await this.hub.start();
  }

  async stop(): Promise<void> {
    if (!this.hub) return;
    await this.hub.stop();
    this.hub = undefined;
  }

  ngOnDestroy(): void {
    void this.stop();
  }
}
