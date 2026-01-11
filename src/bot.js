import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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
        
        if (!data.events || data.events.length === 0) {
          await interaction.editReply('No games found for this date.');
          break;
        }

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle(`${data.leagues[0].name} Scores`)
          .setDescription(`Date: ${data.events[0].date.split('T')[0]}`)
          .setTimestamp()
          .setFooter({ text: 'ESPN' });

        for (const event of data.events.slice(0, 10)) {
          const competition = event.competitions[0];
          const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
          const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
          const detail = event.status.type.detail;

          embed.addFields({
            name: `${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`,
            value: `Score: **${awayTeam.score || '0'} - ${homeTeam.score || '0'}**\nStatus: ${detail}`,
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'standings': {
        const league = interaction.options.getString('league').split('/');
        const data = await espnAPI.getStandings(league[0], league[1]);
        
        if (!data.children || data.children.length === 0) {
          await interaction.editReply('No standings data available.');
          break;
        }

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle(data.name)
          .setTimestamp()
          .setFooter({ text: 'ESPN' });

        for (const division of data.children.slice(0, 3)) {
          if (division.standings?.entries) {
            let divisionText = '';
            for (const entry of division.standings.entries.slice(0, 8)) {
              const team = entry.team;
              const stats = entry.stats;
              const wins = stats.find(s => s.name === 'wins')?.value || 0;
              const losses = stats.find(s => s.name === 'losses')?.value || 0;
              divisionText += `${team.displayName}: **${wins}-${losses}**\n`;
            }
            embed.addFields({ name: division.name, value: divisionText || 'No data', inline: false });
          }
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'odds': {
        const sport = interaction.options.getString('sport').split('/');
        const data = await espnAPI.getOdds(sport[0], sport[1]);
        
        if (!data.events || data.events.length === 0) {
          await interaction.editReply('No betting odds available at this time.');
          break;
        }

        const embed = new EmbedBuilder()
          .setColor('#ffaa00')
          .setTitle('Current Betting Odds')
          .setTimestamp()
          .setFooter({ text: 'ESPN' });

        for (const event of data.events.slice(0, 5)) {
          const competition = event.competitions[0];
          const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
          const awayTeam = competition.competitors.find(t => t.homeAway === 'away');

          let oddsText = '';
          if (competition.odds && competition.odds.length > 0) {
            const odds = competition.odds[0];
            oddsText = `Spread: **${odds.details || 'N/A'}**\nOver/Under: **${odds.overUnder || 'N/A'}**`;
          } else {
            oddsText = 'Odds not available';
          }

          embed.addFields({
            name: `${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`,
            value: oddsText,
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
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
        const embed = new EmbedBuilder()
          .setColor('#9900ff')
          .setTitle(`${data.sports[0].leagues[0].name} Teams`)
          .setTimestamp()
          .setFooter({ text: 'ESPN' });

        let teamsText = '';
        for (const teamObj of teams.slice(0, 32)) {
          const team = teamObj.team;
          teamsText += `${team.displayName} (**${team.abbreviation}**)\n`;
        }

        embed.setDescription(teamsText);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'news': {
        const sport = interaction.options.getString('sport').split('/');
        const data = await espnAPI.getNews(sport[0], sport[1]);

        if (!data.articles || data.articles.length === 0) {
          await interaction.editReply('No news available at this time.');
          break;
        }

        const embeds = [];
        const articles = data.articles.slice(0, 5);
        
        for (const article of articles) {
          const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(article.headline)
            .setURL(article.links.web.href)
            .setDescription(article.description || 'No description available')
            .setTimestamp(new Date(article.published))
            .setFooter({ text: 'ESPN' });

          // Add image if available
          if (article.images && article.images.length > 0) {
            embed.setImage(article.images[0].url);
          }

          embeds.push(embed);
        }

        await interaction.editReply({ embeds: embeds });
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

// Expose client and start function for external control (dashboard/server)
export { client };

/**
 * Start the Discord bot (login and initialize)
 */
export async function startBot() {
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('Bot login initiated');
  } catch (err) {
    console.error('Failed to start bot:', err);
    throw err;
  }
}

// If this file is run directly, start the bot.
if (process.env.START_BOT_DIRECTLY === 'true') {
  startBot();
}
