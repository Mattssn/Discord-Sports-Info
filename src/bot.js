import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import dotenv from 'dotenv';
import espnAPI from './espnAPI.js';
import liveGameManager from './liveGameManager.js';
import scoreCenterManager from './scoreCenterManager.js';

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
    .setName('leaders')
    .setDescription('Get stat leaders for a league')
    .addStringOption(option =>
      option.setName('sport')
        .setDescription('Sport type')
        .setRequired(true)
        .addChoices(
          { name: 'NFL', value: 'football/nfl' },
          { name: 'NBA', value: 'basketball/nba' },
          { name: 'MLB', value: 'baseball/mlb' },
          { name: 'NHL', value: 'hockey/nhl' }
        )
    ),

  new SlashCommandBuilder()
    .setName('rankings')
    .setDescription('Get rankings (college sports only)')
    .addStringOption(option =>
      option.setName('sport')
        .setDescription('Sport type')
        .setRequired(true)
        .addChoices(
          { name: 'College Football', value: 'football/college-football' },
          { name: 'College Basketball (Men)', value: 'basketball/mens-college-basketball' }
        )
    ),

  new SlashCommandBuilder()
    .setName('livegames')
    .setDescription('Show live MLB games and create live update threads'),

  new SlashCommandBuilder()
    .setName('scorecenter')
    .setDescription('Start/stop the live score center with auto-updating channels')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Start or stop the score center')
        .setRequired(true)
        .addChoices(
          { name: 'Start', value: 'start' },
          { name: 'Stop', value: 'stop' }
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
        
        if (!data.teams || data.teams.length === 0) {
          await interaction.editReply('No standings data available.');
          break;
        }

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle(`${league[1].toUpperCase()} Standings`)
          .setTimestamp()
          .setFooter({ text: 'ESPN' });

        // Group teams by division
        const divisions = {};
        for (const teamData of data.teams) {
          // Extract division from standingSummary (e.g., "4th in NFC West" -> "NFC West")
          let divisionName = 'Unknown Division';
          if (teamData.team.standingSummary) {
            const match = teamData.team.standingSummary.match(/in (.+)$/);
            if (match) {
              divisionName = match[1];
            }
          }
          
          if (!divisions[divisionName]) {
            divisions[divisionName] = [];
          }
          divisions[divisionName].push(teamData);
        }

        // Sort divisions by conference (AFC first, then NFC) and then alphabetically
        const sortedDivisions = Object.entries(divisions).sort((a, b) => {
          const [divA] = a;
          const [divB] = b;
          
          // Extract conference (AFC/NFC)
          const confA = divA.split(' ')[0];
          const confB = divB.split(' ')[0];
          
          // Sort by conference first
          if (confA !== confB) {
            return confA.localeCompare(confB);
          }
          // Then sort alphabetically within conference
          return divA.localeCompare(divB);
        });

        // Display each division
        for (const [divisionName, teams] of sortedDivisions) {
          // Sort teams by wins
          const getWins = (team) => team.record.stats.find(s => s.name === 'wins')?.value || 0;
          teams.sort((a, b) => getWins(b) - getWins(a));
          
          let divisionText = '';
          for (const teamData of teams) {
            divisionText += `${teamData.team.displayName}: **${teamData.record.summary}**\n`;
          }
          
          embed.addFields({ name: divisionName, value: divisionText || 'No data', inline: false });
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
          .setFooter({ text: 'ESPN / DraftKings' });

        for (const event of data.events) {
          if (!event.awayTeam || !event.homeTeam) {
            continue;
          }

          let oddsText = '';
          if (event.odds) {
            oddsText = `Spread: **${event.odds.details || 'N/A'}**\n`;
            oddsText += `Over/Under: **${event.odds.overUnder || 'N/A'}**\n`;
            
            if (event.odds.awayTeamOdds?.moneyLine && event.odds.homeTeamOdds?.moneyLine) {
              oddsText += `Money Line: **${event.awayTeam.abbreviation} ${event.odds.awayTeamOdds.moneyLine > 0 ? '+' : ''}${event.odds.awayTeamOdds.moneyLine}** / `;
              oddsText += `**${event.homeTeam.abbreviation} ${event.odds.homeTeamOdds.moneyLine > 0 ? '+' : ''}${event.odds.homeTeamOdds.moneyLine}**`;
            }
          } else {
            oddsText = 'Odds not available';
          }

          embed.addFields({
            name: `${event.awayTeam.displayName} @ ${event.homeTeam.displayName}`,
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

      case 'leaders': {
        const sport = interaction.options.getString('sport').split('/');
        const data = await espnAPI.getLeaders(sport[0], sport[1]);
        
        if (!data.leaders || !data.leaders.categories || data.leaders.categories.length === 0) {
          await interaction.editReply('No stat leaders available at this time.');
          break;
        }

        const embed = new EmbedBuilder()
          .setColor('#0066cc')
          .setTitle(`${data.leaders.name} - Stat Leaders`)
          .setTimestamp()
          .setFooter({ text: 'ESPN' });

        // Show top 3 categories
        for (const category of data.leaders.categories.slice(0, 5)) {
          if (category.leaders && category.leaders.length > 0) {
            let leaderText = '';
            for (const leader of category.leaders.slice(0, 5)) {
              leaderText += `**${leader.athlete.displayName}** (${leader.athlete.team?.abbreviation || 'N/A'}): ${leader.displayValue}\n`;
            }
            embed.addFields({ 
              name: category.displayName, 
              value: leaderText || 'No data', 
              inline: false 
            });
          }
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'rankings': {
        const sport = interaction.options.getString('sport').split('/');
        const data = await espnAPI.getRankings(sport[0], sport[1]);
        
        if (!data.rankings || data.rankings.length === 0) {
          await interaction.editReply('No rankings available at this time.');
          break;
        }

        const ranking = data.rankings[0]; // Get primary ranking
        
        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(ranking.name)
          .setTimestamp()
          .setFooter({ text: 'ESPN' });

        let rankText = '';
        for (const rank of ranking.ranks.slice(0, 25)) {
          const change = rank.current - (rank.previous || rank.current);
          const changeSymbol = change < 0 ? '📈' : change > 0 ? '📉' : '➖';
          rankText += `**${rank.current}.** ${rank.team.displayName || rank.team.nickname} (${rank.recordSummary || 'N/A'}) ${changeSymbol}\n`;
        }
        
        embed.setDescription(rankText);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'livegames': {
        // Fetch current MLB games
        const scoreboardData = await espnAPI.getScoreboard('baseball', 'mlb');
        
        if (!scoreboardData.events || scoreboardData.events.length === 0) {
          await interaction.editReply('No MLB games are currently active.');
          break;
        }

        // Filter for live/in-progress games
        const liveGames = scoreboardData.events.filter(event => {
          const state = event.status.type.state;
          return state === 'in' || state === 'pre';
        });

        if (liveGames.length === 0) {
          await interaction.editReply('No live MLB games at the moment.');
          break;
        }

        const embed = new EmbedBuilder()
          .setColor('#002D62')
          .setTitle('⚾ Live MLB Games')
          .setDescription('Click a button below to create a live update thread for that game!')
          .setTimestamp()
          .setFooter({ text: 'MLB' });

        const rows = [];
        let currentRow = new ActionRowBuilder();
        let buttonCount = 0;

        for (const game of liveGames.slice(0, 10)) {
          const competition = game.competitions[0];
          const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
          const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
          const status = game.status.type.detail;

          embed.addFields({
            name: `${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`,
            value: `Score: ${awayTeam.score || 0} - ${homeTeam.score || 0}\nStatus: ${status}`,
            inline: false
          });

          // Create button for this game
          const button = new ButtonBuilder()
            .setCustomId(`livegame_${game.id}`)
            .setLabel(`${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚾');

          currentRow.addComponents(button);
          buttonCount++;

          // Discord allows max 5 buttons per row
          if (buttonCount === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
          }
        }

        // Add remaining buttons
        if (buttonCount > 0) {
          rows.push(currentRow);
        }

        await interaction.editReply({ embeds: [embed], components: rows });
        break;
      }

      case 'scorecenter': {
        const action = interaction.options.getString('action');
        
        if (action === 'start') {
          const result = await scoreCenterManager.startScoreCenter(interaction.guild);
          await interaction.editReply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
        } else if (action === 'stop') {
          const result = await scoreCenterManager.stopScoreCenter(interaction.guild);
          await interaction.editReply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
        }
        break;
      }

      case 'help': {
        const helpEmbed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('ESPN Sports Bot Commands')
          .setDescription('Get live sports scores, standings, odds, and more from ESPN!')
          .addFields(
            {
              name: '📊 /scores <sport> [date]',
              value: 'Get live scores\n• Sports: NFL, NBA, MLB, NHL, College Football, College Basketball, MLS, WNBA\n• Optional date format: YYYYMMDD',
              inline: false
            },
            {
              name: '🏆 /standings <league>',
              value: 'Get current standings\n• Leagues: NFL, NBA, MLB, NHL, College Football, MLS',
              inline: false
            },
            {
              name: '💰 /odds <sport>',
              value: 'Get betting odds\n• Sports: NFL, NBA, MLB, NHL, College Football',
              inline: false
            },
            {
              name: '👥 /teams <league>',
              value: 'List all teams\n• Leagues: NFL, NBA, MLB, NHL',
              inline: false
            },
            {
              name: '📰 /news <sport>',
              value: 'Get latest news\n• Sports: NFL, NBA, MLB, NHL, College Football',
              inline: false
            },
            {
              name: '⭐ /leaders <sport>',
              value: 'Get stat leaders\n• Sports: NFL, NBA, MLB, NHL',
              inline: false
            },
            {
              name: '📈 /rankings <sport>',
              value: 'Get rankings (college only)\n• Sports: College Football, College Basketball',
              inline: false
            },
            {
              name: '⚾ /livegames',
              value: 'Show live MLB games with buttons to create live update threads\n• Creates a thread with real-time play-by-play updates\n• Thread auto-closes 1 hour after game ends',
              inline: false
            },
            {
              name: '📺 /scorecenter <start|stop>',
              value: 'Start/stop the live score center\n• Automatically creates categories for each sport\n• Creates channels showing live scores in channel names\n• Updates every 30 seconds\n• Supports: NFL, NBA, NHL, MLB',
              inline: false
            }
          )
          .addFields({
            name: '📝 Examples',
            value: '`/scores sport:NFL`\n`/standings league:NFL`\n`/odds sport:NBA`\n`/leaders sport:NFL`\n`/rankings sport:College Football`\n`/livegames` - Track live MLB games\n`/scorecenter action:start` - Start score center',
            inline: false
          })
          .setFooter({ text: 'Data provided by ESPN API' })
          .setTimestamp();

        await interaction.editReply({ embeds: [helpEmbed] });
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

// Handle button interactions for live games
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('livegame_')) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const gameId = interaction.customId.replace('livegame_', '');
      
      // Create a thread for this game
      const threadName = `⚾ Live Game ${gameId}`;
      const thread = await interaction.channel.threads.create({
        name: threadName,
        autoArchiveDuration: 1440, // 24 hours
        reason: 'Live MLB game updates'
      });

      // Start tracking the game
      const result = await liveGameManager.startTracking(gameId, thread, interaction.channelId);
      
      if (result.success) {
        await interaction.editReply(`✅ Created live thread: <#${thread.id}>\nLive updates will appear there!`);
      } else {
        await interaction.editReply(`❌ ${result.message}`);
        await thread.delete();
      }
    } catch (error) {
      console.error('Error handling live game button:', error);
      await interaction.editReply('❌ Failed to create live game thread.');
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
