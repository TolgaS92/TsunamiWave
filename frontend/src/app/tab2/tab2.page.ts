import { Component, OnDestroy, OnInit } from '@angular/core';
import { WatchlistService } from '../services/watchlist.service';
import { QuotesService, QuoteUpdate } from '../services/quotes.service';
import { ApexChart, ApexAxisChartSeries, ApexStroke, ApexXAxis, ApexDataLabels, ApexTooltip } from 'ng-apexcharts';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  private readonly backendBaseUrl = 'http://localhost:5145';
  symbols: string[] = [];
  latestBySymbol = new Map<string, QuoteUpdate>();
  sparkDataBySymbol = new Map<string, Array<[number, number]>>();

  sparkChart: ApexChart = {
    type: 'line',
    height: 80,
    sparkline: { enabled: true },
    animations: {
      enabled: true,
      speed: 400,
      dynamicAnimation: { enabled: true, speed: 250 }
    }
  };
  sparkStroke: ApexStroke = { curve: 'smooth', width: 2 };
  sparkXAxis: ApexXAxis = { type: 'datetime' };
  sparkDataLabels: ApexDataLabels = { enabled: false };
  sparkTooltip: ApexTooltip = { x: { format: 'HH:mm:ss' } };

  constructor(
    private readonly watchlist: WatchlistService,
    private readonly quotes: QuotesService
  ) {}

  async ngOnInit(): Promise<void> {
    this.symbols = this.watchlist.getSymbols();
    await this.quotes.start(this.backendBaseUrl);
    this.quotes.quotes$.subscribe(u => {
      if (!u) return;
      if (!this.symbols.includes(u.symbol)) return;
      this.latestBySymbol.set(u.symbol, u);
      const arr = this.sparkDataBySymbol.get(u.symbol) ?? [];
      arr.push([new Date(u.timestampUtc).getTime(), u.price]);
      if (arr.length > 60) arr.shift();
      this.sparkDataBySymbol.set(u.symbol, [...arr]);
    });
  }

  async ngOnDestroy(): Promise<void> {
    await this.quotes.stop();
  }

  trackBySymbol = (_: number, s: string) => s;

  getSeries(symbol: string): ApexAxisChartSeries {
    const data = this.sparkDataBySymbol.get(symbol) ?? [];
    return [{ name: symbol, data }];
  }

  priceClass(symbol: string): string {
    const data = this.sparkDataBySymbol.get(symbol) ?? [];
    if (data.length < 2) return '';
    const prev = data[data.length - 2][1];
    const curr = data[data.length - 1][1];
    return curr >= prev ? 'up' : 'down';
  }
}
