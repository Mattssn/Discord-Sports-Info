import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import espnAPI from './espnAPI.js';

dotenv.config();

// Validate environment variables
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('Error: Missing DISCORD_TOKEN or CLIENT_ID in .env file');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('scores')
    .setDescription('Get live scores for a sport')
    .addStringOption(option =>
      option.setName('sport')
        .setDescription('Sport type')
        .setRequired(true)
        .addChoices(
          { name: 'NFL', value: 'football/nfl' },
          { name: 'NBA', value: 'basketball/nba' },
          { name: 'MLB', value: 'baseball/mlb' },
          { name: 'NHL', value: 'hockey/nhl' },
          { name: 'College Football', value: 'football/college-football' },
          { name: 'College Basketball', value: 'basketball/mens-college-basketball' },
          { name: 'MLS', value: 'soccer/usa.1' },
          { name: 'WNBA', value: 'basketball/wnba' }
        )
    )
    .addStringOption(option =>
      option.setName('date')
        .setDescription('Date in YYYYMMDD format (optional)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('standings')
    .setDescription('Get standings for a league')
    .addStringOption(option =>
      option.setName('league')
        .setDescription('League')
        .setRequired(true)
        .addChoices(
          { name: 'NFL', value: 'football/nfl' },
          { name: 'NBA', value: 'basketball/nba' },
          { name: 'MLB', value: 'baseball/mlb' },
          { name: 'NHL', value: 'hockey/nhl' },
          { name: 'College Football', value: 'football/college-football' },
          { name: 'MLS', value: 'soccer/usa.1' }
        )
    ),

  new SlashCommandBuilder()
    .setName('odds')
    .setDescription('Get betting odds for upcoming games')
    .addStringOption(option =>
      option.setName('sport')
        .setDescription('Sport type')
        .setRequired(true)
        .addChoices(
          { name: 'NFL', value: 'football/nfl' },
          { name: 'NBA', value: 'basketball/nba' },
          { name: 'MLB', value: 'baseball/mlb' },
          { name: 'NHL', value: 'hockey/nhl' },
          { name: 'College Football', value: 'football/college-football' }
        )
    ),

  new SlashCommandBuilder()
    .setName('teams')
    .setDescription('Get teams for a league')
    .addStringOption(option =>
      option.setName('league')
        .setDescription('League')
        .setRequired(true)
        .addChoices(
          { name: 'NFL', value: 'football/nfl' },
          { name: 'NBA', value: 'basketball/nba' },
          { name: 'MLB', value: 'baseball/mlb' },
          { name: 'NHL', value: 'hockey/nhl' }
        )
    ),

  new SlashCommandBuilder()
    .setName('news')
    .setDescription('Get latest news for a sport')
    .addStringOption(option =>
      option.setName('sport')
        .setDescription('Sport type')
        .setRequired(true)
        .addChoices(
          { name: 'NFL', value: 'football/nfl' },
          { name: 'NBA', value: 'basketball/nba' },
          { name: 'MLB', value: 'baseball/mlb' },
          { name: 'NHL', value: 'hockey/nhl' },
          { name: 'College Football', value: 'football/college-football' }
        )
    ),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show bot commands and usage information')
].map(command => command.toJSON());

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('Successfully registered slash commands!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Bot ready event
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await registerCommands();
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    await interaction.deferReply();

    switch (commandName) {
      case 'scores': {
        const sportLeague = interaction.options.getString('sport').split('/');
        const date = interaction.options.getString('date');
        const data = await espnAPI.getScoreboard(sportLeague[0], sportLeague[1], date);
        const message = espnAPI.formatScoreboard(data);
        await interaction.editReply(message);
        break;
      }

      case 'standings': {
        const league = interaction.options.getString('league').split('/');
        const data = await espnAPI.getStandings(league[0], league[1]);
        const message = espnAPI.formatStandings(data);
        await interaction.editReply(message);
        break;
      }

      case 'odds': {
        const sport = interaction.options.getString('sport').split('/');
        const data = await espnAPI.getOdds(sport[0], sport[1]);
        const message = espnAPI.formatOdds(data);
        await interaction.editReply(message);
        break;
      }

      case 'teams': {
        const league = interaction.options.getString('league').split('/');
        const data = await espnAPI.getTeams(league[0], league[1]);

        if (!data.sports || !data.sports[0].leagues || !data.sports[0].leagues[0].teams) {
          await interaction.editReply('No teams data available.');
          break;
        }

        const teams = data.sports[0].leagues[0].teams;
        let message = `**${data.sports[0].leagues[0].name} Teams**\n\n`;

        for (const teamObj of teams.slice(0, 32)) {
          const team = teamObj.team;
          message += `${team.displayName} (${team.abbreviation})\n`;
        }

        await interaction.editReply(message);
        break;
      }

      case 'news': {
        const sport = interaction.options.getString('sport').split('/');
        const data = await espnAPI.getNews(sport[0], sport[1]);

        if (!data.articles || data.articles.length === 0) {
          await interaction.editReply('No news available at this time.');
          break;
        }

        let message = '**Latest Sports News**\n\n';
        for (const article of data.articles.slice(0, 5)) {
          message += `**${article.headline}**\n`;
          message += `${article.description || 'No description'}\n`;
          message += `[Read more](${article.links.web.href})\n\n`;
        }

        await interaction.editReply(message);
        break;
      }

      case 'help': {
        const helpMessage = `
**ESPN Sports Bot Commands**

\`/scores <sport> [date]\` - Get live scores
  • Optional date format: YYYYMMDD (e.g., 20250111)
  • Supports: NFL, NBA, MLB, NHL, College Football, College Basketball, MLS, WNBA

\`/standings <league>\` - Get current standings
  • Supports: NFL, NBA, MLB, NHL, College Football, MLS

\`/odds <sport>\` - Get betting odds for upcoming games
  • Supports: NFL, NBA, MLB, NHL, College Football

\`/teams <league>\` - List all teams in a league
  • Supports: NFL, NBA, MLB, NHL

\`/news <sport>\` - Get latest news headlines
  • Supports: NFL, NBA, MLB, NHL, College Football

**Examples:**
• \`/scores sport:NFL\` - Current NFL scores
• \`/scores sport:NBA date:20250115\` - NBA scores for specific date
• \`/standings league:NFL\` - NFL standings
• \`/odds sport:NBA\` - NBA betting odds

**Data provided by ESPN API**
        `;
        await interaction.editReply(helpMessage);
        break;
      }

      default:
        await interaction.editReply('Unknown command.');
    }
  } catch (error) {
    console.error(`Error handling ${commandName}:`, error);
    const errorMessage = 'Sorry, there was an error fetching data from ESPN. Please try again later.';

    if (interaction.deferred) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
