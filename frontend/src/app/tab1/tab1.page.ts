import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { QuotesService, QuoteUpdate } from '../services/quotes.service';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexStroke,
  ApexDataLabels,
  ApexGrid,
  ApexTooltip,
  ApexTheme,
  ApexYAxis,
  ApexMarkers,
  ApexFill
} from 'ng-apexcharts';
import { ChartComponent } from 'ng-apexcharts';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit, OnDestroy {
  @ViewChild('priceChart') chartRef?: ChartComponent;
  latest?: QuoteUpdate | null;
  private readonly backendBaseUrl = 'http://localhost:5145';
  symbols = ['AAPL','MSFT','GOOG','AMZN','TSLA'];
  selectedSymbol = 'AAPL';

  // Chart config
  series: ApexAxisChartSeries = [{ name: 'Price', data: [] }];
  chart: ApexChart = {
    type: 'line',
    height: 300,
    animations: {
      enabled: true,
      speed: 500,
      animateGradually: { enabled: true, delay: 80 },
      dynamicAnimation: { enabled: true, speed: 300 }
    },
    foreColor: '#e5e9f0',
    toolbar: { show: false },
    zoom: { enabled: false },
    dropShadow: { enabled: true, color: '#22d3ee', top: 0, left: 0, blur: 12, opacity: 0.8 }
  };
  xaxis: ApexXAxis = { type: 'datetime', labels: { show: false } };
  yaxis: ApexYAxis = { labels: { formatter: (v) => v.toFixed(2) } };
  stroke: ApexStroke = { curve: 'smooth', width: 6 };
  dataLabels: ApexDataLabels = { enabled: false };
  grid: ApexGrid = { strokeDashArray: 4, borderColor: '#475569' };
  tooltip: ApexTooltip = { theme: 'dark', x: { format: 'HH:mm:ss' } };
  theme: ApexTheme = { mode: 'dark' };
  markers: ApexMarkers = { size: 4, strokeWidth: 0 } as any;
  fill: ApexFill = { type: 'gradient', gradient: { shadeIntensity: 0.9, gradientToColors: ['#a5f3fc'], opacityFrom: 0.7, opacityTo: 0.25, stops: [0, 70, 100] } };
  colors: string[] = ['#22d3ee'];

  constructor(private readonly quotes: QuotesService) {}

  async ngOnInit(): Promise<void> {
    await this.quotes.start(this.backendBaseUrl);
    this.quotes.quotes$.subscribe(u => {
      this.latest = u;
      if (!u || u.symbol !== this.selectedSymbol) return;
      const point: [number, number] = [new Date(u.timestampUtc).getTime(), u.price];
      if (this.chartRef) {
        this.chartRef.appendData([{ data: [point] }]);
        const current = (this.series[0].data as any[]) ?? [];
        const length = current.length;
        if (length > 0 && length % 40 === 0) {
          const trimmed = current.slice(Math.max(0, length - 120));
          this.series = [{ name: 'Price', data: trimmed }];
        }
      } else {
        const next = [...(this.series[0].data as any[])];
        next.push(point);
        if (next.length > 120) next.shift();
        this.series = [{ name: 'Price', data: next }];
      }
    });
  }

  async ngOnDestroy(): Promise<void> {
    await this.quotes.stop();
  }

  onChangeSymbol(symbol: string): void {
    this.selectedSymbol = symbol;
    this.series = [{ name: 'Price', data: [] }];
  }
}
