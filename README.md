# Discord ESPN Sports Bot

A Discord bot that fetches live sports scores, betting odds, standings, team information, and news from the ESPN API.

## Features

- **Live Scores**: Get real-time scores for NFL, NBA, MLB, NHL, College Sports, MLS, WNBA
- **Betting Odds**: View current betting lines and spreads
- **Standings**: Check league standings
- **Team Lists**: Browse all teams in a league
- **Sports News**: Latest headlines and articles
- **Multiple Sports**: Support for major professional and college sports

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/scores <sport> [date]` | Get live scores (optional date YYYYMMDD) | `/scores sport:NFL` |
| `/standings <league>` | Get current standings | `/standings league:NBA` |
| `/odds <sport>` | Get betting odds | `/odds sport:NFL` |
| `/teams <league>` | List all teams | `/teams league:MLB` |
| `/news <sport>` | Get latest news | `/news sport:NHL` |
| `/help` | Show all commands | `/help` |

## Setup Instructions

### Prerequisites

- Node.js 18 or higher
- A Discord account
- A Discord application/bot token

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Discord-Sports-Info
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under "Token", click "Reset Token" and copy the token (save it securely!)
5. Enable these Privileged Gateway Intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
6. Go to the "OAuth2" tab and copy your Client ID

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   ESPN_RATE_LIMIT=100
   ```

### 5. Invite Bot to Your Server

1. Go to OAuth2 > URL Generator in the Discord Developer Portal
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### 6. Run the Bot

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

You should see:
```
Logged in as YourBotName#1234!
Registering slash commands...
Successfully registered slash commands!
```

### 7. Use the Bot

In your Discord server, type `/` and you should see all the bot commands appear. Try:

- `/scores sport:NFL` - Get current NFL scores
- `/standings league:NBA` - See NBA standings
- `/odds sport:NFL` - View betting odds
- `/help` - Show all commands

## Supported Sports

### Scores & Odds
- **NFL** - National Football League
- **NBA** - National Basketball Association
- **MLB** - Major League Baseball
- **NHL** - National Hockey League
- **College Football**
- **College Basketball**
- **MLS** - Major League Soccer
- **WNBA** - Women's National Basketball Association

### Standings & Teams
- **NFL**
- **NBA**
- **MLB**
- **NHL**
- **College Football**
- **MLS**

## Project Structure

```
Discord-Sports-Info/
├── src/
│   ├── bot.js          # Main bot file with Discord commands
│   └── espnAPI.js      # ESPN API service and data formatting
├── .env.example        # Environment variables template
├── .gitignore         # Git ignore file
├── package.json       # Node.js dependencies
└── README.md          # This file
```

## ESPN API Information

This bot uses the unofficial ESPN API. The API endpoints are:
- `site.api.espn.com` - Scores, teams, standings, news
- `sports.core.api.espn.com` - Detailed stats and odds

**Note**: These APIs are not officially supported by ESPN and may change without notice. The bot includes rate limiting to be respectful of ESPN's servers.

## Troubleshooting

### Bot doesn't respond to commands
- Make sure the bot has the "Use Slash Commands" permission
- Check that commands are registered (you should see "Successfully registered slash commands!" in console)
- Wait a few minutes for Discord to propagate the commands globally

### "Missing DISCORD_TOKEN or CLIENT_ID" error
- Make sure you created a `.env` file (not `.env.example`)
- Verify your Discord token and client ID are correct
- Don't include quotes around the values in `.env`

### ESPN API errors
- The ESPN API may be temporarily unavailable
- Some data (like odds) may not be available for all sports/times
- Rate limiting is built in, but excessive requests may still fail

## Contributing

Feel free to open issues or submit pull requests for improvements!

## License

MIT License - See LICENSE file for details

## Disclaimer

This bot uses the unofficial ESPN API. ESPN data and trademarks are property of ESPN, Inc. This project is not affiliated with or endorsed by ESPN.
