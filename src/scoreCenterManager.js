import { ChannelType, PermissionFlagsBits } from 'discord.js';
import espnAPI from './espnAPI.js';

/**
 * Score Center Manager
 * Creates and manages live score channels organized by sport categories
 */
class ScoreCenterManager {
  constructor() {
    this.activeGames = new Map(); // gameId -> { channelId, categoryId, sport, league }
    this.categories = new Map(); // sport -> categoryId
    this.updateInterval = null;
    this.guildId = null;
    this.client = null;
  }

  /**
   * Initialize the score center
   */
  async initialize(client, guildId) {
    this.client = client;
    this.guildId = guildId;
  }

  /**
   * Start the score center in a guild
   */
  async startScoreCenter(guild) {
    if (this.updateInterval) {
      return { success: false, message: 'Score center is already running!' };
    }

    try {
      this.guildId = guild.id;
      
      // Initial scan and setup
      await this.scanAndUpdateGames(guild);
      
      // Update every 30 seconds
      this.updateInterval = setInterval(async () => {
        await this.scanAndUpdateGames(guild);
      }, 30000);

      return { success: true, message: 'Score center started! Categories and channels will be created for active games.' };
    } catch (error) {
      console.error('Error starting score center:', error);
      return { success: false, message: 'Failed to start score center.' };
    }
  }

  /**
   * Stop the score center
   */
  async stopScoreCenter(guild) {
    if (!this.updateInterval) {
      return { success: false, message: 'Score center is not running.' };
    }

    clearInterval(this.updateInterval);
    this.updateInterval = null;

    // Clean up channels and categories
    await this.cleanup(guild);

    return { success: true, message: 'Score center stopped and cleaned up.' };
  }

  /**
   * Scan for active games across all sports and update channels
   */
  async scanAndUpdateGames(guild) {
    try {
      const sports = [
        { name: 'NFL', sport: 'football', league: 'nfl', emoji: '🏈' },
        { name: 'NBA', sport: 'basketball', league: 'nba', emoji: '🏀' },
        { name: 'NHL', sport: 'hockey', league: 'nhl', emoji: '🏒' },
        { name: 'MLB', sport: 'baseball', league: 'mlb', emoji: '⚾' }
      ];

      const activeGameIds = new Set();

      for (const sportInfo of sports) {
        try {
          const scoreboardData = await espnAPI.getScoreboard(sportInfo.sport, sportInfo.league);
          
          if (!scoreboardData.events || scoreboardData.events.length === 0) {
            // No games for this sport, remove category if it exists
            await this.removeCategory(guild, sportInfo.name);
            continue;
          }

          // Filter for live/in-progress games
          const liveGames = scoreboardData.events.filter(event => {
            const state = event.status.type.state;
            return state === 'in' || state === 'pre';
          });

          if (liveGames.length === 0) {
            // No live games, remove category
            await this.removeCategory(guild, sportInfo.name);
            continue;
          }

          // Get or create category for this sport
          const category = await this.getOrCreateCategory(guild, sportInfo.name, sportInfo.emoji);

          // Update channels for each live game
          for (const game of liveGames) {
            activeGameIds.add(game.id);
            await this.updateGameChannel(guild, category, game, sportInfo);
          }
        } catch (error) {
          console.error(`Error processing ${sportInfo.name}:`, error);
        }
      }

      // Clean up channels for games that are no longer active
      await this.cleanupInactiveGames(guild, activeGameIds);
    } catch (error) {
      console.error('Error scanning games:', error);
    }
  }

  /**
   * Get or create a category for a sport
   */
  async getOrCreateCategory(guild, sportName, emoji) {
    const categoryName = `${emoji} ${sportName} Live Scores`;
    
    // Check if category already exists in our map
    if (this.categories.has(sportName)) {
      const categoryId = this.categories.get(sportName);
      const category = guild.channels.cache.get(categoryId);
      if (category) return category;
    }

    // Search for existing category
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === categoryName
    );

    if (!category) {
      // Create new category
      category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        position: 0 // Put at top
      });
    }

    this.categories.set(sportName, category.id);
    return category;
  }

  /**
   * Remove category if no games
   */
  async removeCategory(guild, sportName) {
    if (!this.categories.has(sportName)) return;

    const categoryId = this.categories.get(sportName);
    const category = guild.channels.cache.get(categoryId);
    
    if (category) {
      // Delete all channels in the category first
      const channels = guild.channels.cache.filter(c => c.parentId === categoryId);
      for (const channel of channels.values()) {
        try {
          await channel.delete();
        } catch (error) {
          console.error('Error deleting channel:', error);
        }
      }
      
      // Delete the category
      try {
        await category.delete();
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }

    this.categories.delete(sportName);
  }

  /**
   * Update or create a channel for a game
   */
  async updateGameChannel(guild, category, game, sportInfo) {
    try {
      const competition = game.competitions[0];
      const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
      const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
      
      const awayScore = awayTeam.score || 0;
      const homeScore = homeTeam.score || 0;
      const status = game.status.type.detail;
      
      // Create channel name: "away-vs-home-score"
      const channelName = `${awayTeam.team.abbreviation}-${awayScore}-${homeScore}-${homeTeam.team.abbreviation}`.toLowerCase();

      let channel;
      
      // Check if we already have a channel for this game
      if (this.activeGames.has(game.id)) {
        const channelId = this.activeGames.get(game.id).channelId;
        channel = guild.channels.cache.get(channelId);
      }

      if (!channel) {
        // Create new channel
        channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: `${awayTeam.team.displayName} @ ${homeTeam.team.displayName} | ${status}`,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.SendMessages], // Read-only for everyone
            }
          ]
        });

        // Send initial game info
        await channel.send(`**${awayTeam.team.displayName}** ${awayScore} - ${homeScore} **${homeTeam.team.displayName}**\n${status}`);

        this.activeGames.set(game.id, {
          channelId: channel.id,
          categoryId: category.id,
          sport: sportInfo.sport,
          league: sportInfo.league
        });
      } else {
        // Update existing channel name and topic
        await channel.setName(channelName);
        await channel.setTopic(`${awayTeam.team.displayName} @ ${homeTeam.team.displayName} | ${status}`);
      }

      // Check if game is final
      const state = game.status.type.state;
      if (state === 'post') {
        // Game is over, schedule deletion
        setTimeout(async () => {
          try {
            await channel.delete();
            this.activeGames.delete(game.id);
          } catch (error) {
            console.error('Error deleting finished game channel:', error);
          }
        }, 3600000); // Delete after 1 hour
      }
    } catch (error) {
      console.error('Error updating game channel:', error);
    }
  }

  /**
   * Clean up channels for games that are no longer active
   */
  async cleanupInactiveGames(guild, activeGameIds) {
    for (const [gameId, gameInfo] of this.activeGames.entries()) {
      if (!activeGameIds.has(gameId)) {
        try {
          const channel = guild.channels.cache.get(gameInfo.channelId);
          if (channel) {
            await channel.delete();
          }
          this.activeGames.delete(gameId);
        } catch (error) {
          console.error('Error cleaning up inactive game:', error);
        }
      }
    }
  }

  /**
   * Clean up all score center channels and categories
   */
  async cleanup(guild) {
    try {
      // Delete all game channels
      for (const gameInfo of this.activeGames.values()) {
        try {
          const channel = guild.channels.cache.get(gameInfo.channelId);
          if (channel) await channel.delete();
        } catch (error) {
          console.error('Error deleting channel:', error);
        }
      }

      // Delete all categories
      for (const categoryId of this.categories.values()) {
        try {
          const category = guild.channels.cache.get(categoryId);
          if (category) await category.delete();
        } catch (error) {
          console.error('Error deleting category:', error);
        }
      }

      this.activeGames.clear();
      this.categories.clear();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Check if score center is running
   */
  isRunning() {
    return this.updateInterval !== null;
  }
}

export default new ScoreCenterManager();
