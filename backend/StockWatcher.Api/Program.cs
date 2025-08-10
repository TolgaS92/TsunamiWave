using Microsoft.AspNetCore.SignalR;
using System.Net.Http;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .SetIsOriginAllowed(_ => true);
    });
});
builder.Services.AddSignalR();
builder.Services.AddSingleton<QuoteStreamBroker>();
builder.Services.AddHttpClient();

var finnhubApiKey = builder.Configuration["FINNHUB_API_KEY"] ?? Environment.GetEnvironmentVariable("FINNHUB_API_KEY") ?? string.Empty;
builder.Services.AddSingleton(new FinnhubOptions
{
    ApiKey = finnhubApiKey,
    Symbols = new[] { "AAPL", "MSFT", "GOOG", "AMZN", "TSLA" }
});
builder.Services.AddHostedService<FinnhubWebSocketService>();

var app = builder.Build();

// Pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors();

// Endpoints
app.MapHub<QuotesHub>("/hubs/quotes");

app.Run();

// SignalR hub for live quotes
class QuotesHub : Hub
{
}

// In-memory broker to publish quotes to connected clients
class QuoteStreamBroker
{
    private readonly IHubContext<QuotesHub> hubContext;

    public QuoteStreamBroker(IHubContext<QuotesHub> hubContext)
    {
        this.hubContext = hubContext;
    }

    public Task BroadcastAsync(QuoteUpdate update, CancellationToken cancellationToken)
    {
        return hubContext.Clients.All.SendAsync("quote", update, cancellationToken);
    }
}

// Finnhub WebSocket streaming (free dev API key required)
class FinnhubWebSocketService : BackgroundService
{
    private readonly QuoteStreamBroker broker;
    private readonly FinnhubOptions options;
    private readonly ILogger<FinnhubWebSocketService> logger;

    public FinnhubWebSocketService(QuoteStreamBroker broker, FinnhubOptions options, ILogger<FinnhubWebSocketService> logger)
    {
        this.broker = broker;
        this.options = options;
        this.logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
        {
            logger.LogError("FINNHUB_API_KEY is not set. Please set an environment variable FINNHUB_API_KEY with your free Finnhub API key.");
            return;
        }

        var uri = new Uri($"wss://ws.finnhub.io?token={options.ApiKey}");
        var backoff = TimeSpan.FromSeconds(1);
        var maxBackoff = TimeSpan.FromSeconds(30);

        while (!stoppingToken.IsCancellationRequested)
        {
            using var socket = new ClientWebSocket();
            try
            {
                await socket.ConnectAsync(uri, stoppingToken);
                logger.LogInformation("Connected to Finnhub WS");

                foreach (var s in options.Symbols)
                {
                    var sub = $"{{\"type\":\"subscribe\",\"symbol\":\"{s}\"}}";
                    await socket.SendAsync(Encoding.UTF8.GetBytes(sub), WebSocketMessageType.Text, true, stoppingToken);
                }

                var buffer = new byte[64 * 1024];
                while (socket.State == WebSocketState.Open && !stoppingToken.IsCancellationRequested)
                {
                    var result = await socket.ReceiveAsync(buffer, stoppingToken);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        break;
                    }

                    var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    var message = JsonSerializer.Deserialize<FinnhubMessage>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (message?.Type == "trade" && message.Data != null)
                    {
                        foreach (var t in message.Data)
                        {
                            if (string.IsNullOrWhiteSpace(t.S)) continue;
                            var ts = DateTimeOffset.FromUnixTimeMilliseconds(t.T).UtcDateTime;
                            var update = new QuoteUpdate
                            {
                                Symbol = t.S,
                                Price = Math.Round((decimal)t.P, 2),
                                TimestampUtc = ts
                            };
                            await broker.BroadcastAsync(update, stoppingToken);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "WS error; will reconnect");
            }
            finally
            {
                try { await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None); } catch { }
            }

            await Task.Delay(backoff, stoppingToken);
            backoff = TimeSpan.FromSeconds(Math.Min(maxBackoff.TotalSeconds, backoff.TotalSeconds * 2));
        }
    }
}

record FinnhubOptions
{
    public string ApiKey { get; init; } = string.Empty;
    public string[] Symbols { get; init; } = Array.Empty<string>();
}

class FinnhubMessage
{
    public string? Type { get; set; }
    public List<FinnhubTrade>? Data { get; set; }
}

class FinnhubTrade
{
    public string S { get; set; } = string.Empty; // symbol
    public double P { get; set; } // price
    public long T { get; set; } // timestamp ms
}

record QuoteUpdate
{
    public string Symbol { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public DateTime TimestampUtc { get; init; }
}

