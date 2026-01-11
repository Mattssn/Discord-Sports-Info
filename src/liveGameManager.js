import WebSocket from 'ws';
import fetch from 'node-fetch';
import { EmbedBuilder } from 'discord.js';

/**
 * Live Game Manager for MLB
 * Manages websocket connections and thread updates for live games
 */
class LiveGameManager {
  constructor() {
    this.activeGames = new Map(); // gameId -> { ws, thread, interval, gameData }
    this.mlbBaseURL = 'https://statsapi.mlb.com/api/v1.1/game';
  }

  /**
   * Fetch MLB game data
   */
  async fetchMLBGame(gameId, timestamp = null) {
    try {
      let url = `${this.mlbBaseURL}/${gameId}/feed/live`;
      if (timestamp) {
        url += `?timecode=${timestamp}`;
      }
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching MLB game ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Start tracking a live game
   */
  async startTracking(gameId, thread, channelId) {
    if (this.activeGames.has(gameId)) {
      return { success: false, message: 'Game is already being tracked!' };
    }

    try {
      // Fetch initial game data
      const initialData = await this.fetchMLBGame(gameId);
      if (!initialData) {
        return { success: false, message: 'Failed to fetch game data.' };
      }

      // Connect to websocket
      const wsUrl = `wss://ws.statsapi.mlb.com/api/v1/game/push/subscribe/gameday/${gameId}`;
      const ws = new WebSocket(wsUrl);

      let lastTimestamp = null;
      let keepAliveInterval = null;

      ws.on('open', () => {
        console.log(`Connected to MLB game ${gameId}`);
        
        // Send keepalive message every 60 seconds
        keepAliveInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('Gameday5');
          }
        }, 60000);

        // Send initial message
        ws.send('Gameday5');
      });

      ws.on('message', async (data) => {
        try {
          const update = JSON.parse(data.toString());
          
          if (update.timeStamp && update.timeStamp !== lastTimestamp) {
            lastTimestamp = update.timeStamp;
            
            // Fetch updated game data
            const gameData = await this.fetchMLBGame(gameId, lastTimestamp);
            if (gameData) {
              await this.updateThread(thread, gameData, update);
            }
          }
        } catch (error) {
          console.error(`Error processing update for game ${gameId}:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for game ${gameId}:`, error);
      });

      ws.on('close', () => {
        console.log(`WebSocket closed for game ${gameId}`);
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        this.stopTracking(gameId);
      });

      // Store game tracking info
      this.activeGames.set(gameId, {
        ws,
        thread,
        channelId,
        keepAliveInterval,
        gameData: initialData,
        startTime: Date.now()
      });

      // Post initial game info to thread
      await this.postInitialGameInfo(thread, initialData);

      // Check game status periodically
      const statusCheckInterval = setInterval(async () => {
        const gameInfo = this.activeGames.get(gameId);
        if (gameInfo) {
          const currentData = await this.fetchMLBGame(gameId);
          if (currentData && this.isGameOver(currentData)) {
            await this.handleGameEnd(gameId, thread);
            clearInterval(statusCheckInterval);
          }
        } else {
          clearInterval(statusCheckInterval);
        }
      }, 300000); // Check every 5 minutes

      return { success: true, message: 'Started tracking game!' };
    } catch (error) {
      console.error(`Error starting game tracking for ${gameId}:`, error);
      return { success: false, message: 'Failed to start tracking.' };
    }
  }

  /**
   * Post initial game information to thread
   */
  async postInitialGameInfo(thread, gameData) {
    try {
      const game = gameData.gameData;
      const liveData = gameData.liveData;
      
      const awayTeam = game.teams.away;
      const homeTeam = game.teams.home;
      
      const embed = new EmbedBuilder()
        .setColor('#002D62')
        .setTitle(`${awayTeam.teamName} @ ${homeTeam.teamName}`)
        .setDescription(`**${game.venue.name}** • ${game.datetime.time} ${game.datetime.ampm}`)
        .addFields(
          { 
            name: `${awayTeam.teamName}`, 
            value: `Record: ${awayTeam.record?.wins || 0}-${awayTeam.record?.losses || 0}`,
            inline: true 
          },
          { 
            name: `${homeTeam.teamName}`, 
            value: `Record: ${homeTeam.record?.wins || 0}-${homeTeam.record?.losses || 0}`,
            inline: true 
          }
        )
        .setFooter({ text: 'MLB Live Game Updates' })
        .setTimestamp();

      await thread.send({ embeds: [embed] });
      await thread.send('🎮 **Game is starting! Live updates will appear here...**');
    } catch (error) {
      console.error('Error posting initial game info:', error);
    }
  }

  /**
   * Update thread with new game data
   */
  async updateThread(thread, gameData, wsUpdate) {
    try {
      const liveData = gameData.liveData;
      const plays = liveData.plays;
      const currentPlay = plays.currentPlay;
      
      if (!currentPlay || !wsUpdate.gameEvents || wsUpdate.gameEvents.length === 0) {
        return;
      }

      const awayScore = liveData.linescore?.teams?.away?.runs || 0;
      const homeScore = liveData.linescore?.teams?.home?.runs || 0;
      const inning = liveData.linescore?.currentInning || 1;
      const inningHalf = liveData.linescore?.inningHalf || 'Top';
      
      // Build update message
      let message = `**${inningHalf} ${inning}** | ${gameData.gameData.teams.away.abbreviation} ${awayScore} - ${homeScore} ${gameData.gameData.teams.home.abbreviation}\n`;
      
      if (currentPlay.result && currentPlay.result.description) {
        message += `\n${currentPlay.result.description}`;
      }

      // Check for significant events
      const events = wsUpdate.logicalEvents || [];
      if (events.includes('homeRun')) {
        message += '\n🔥 **HOME RUN!**';
      } else if (events.includes('strikeout')) {
        message += '\n⚾ Strikeout';
      } else if (events.includes('walk')) {
        message += '\n👟 Walk';
      }

      await thread.send(message);
    } catch (error) {
      console.error('Error updating thread:', error);
    }
  }

  /**
   * Check if game is over
   */
  isGameOver(gameData) {
    const status = gameData.gameData?.status?.detailedState;
    return status === 'Final' || status === 'Game Over' || status === 'Completed Early';
  }

  /**
   * Handle game end
   */
  async handleGameEnd(gameId, thread) {
    try {
      const gameInfo = this.activeGames.get(gameId);
      if (!gameInfo) return;

      const finalData = await this.fetchMLBGame(gameId);
      if (finalData) {
        const awayScore = finalData.liveData.linescore?.teams?.away?.runs || 0;
        const homeScore = finalData.liveData.linescore?.teams?.home?.runs || 0;
        const awayTeam = finalData.gameData.teams.away.abbreviation;
        const homeTeam = finalData.gameData.teams.home.abbreviation;

        await thread.send(`\n🏁 **GAME FINAL**\n${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`);
        await thread.send('This thread will be locked in 1 hour.');
      }

      // Stop tracking immediately
      this.stopTracking(gameId);

      // Archive thread after 1 hour
      setTimeout(async () => {
        try {
          await thread.setArchived(true);
          await thread.setLocked(true);
        } catch (error) {
          console.error('Error archiving thread:', error);
        }
      }, 3600000); // 1 hour
    } catch (error) {
      console.error('Error handling game end:', error);
    }
  }

  /**
   * Stop tracking a game
   */
  stopTracking(gameId) {
    const gameInfo = this.activeGames.get(gameId);
    if (gameInfo) {
      if (gameInfo.ws) {
        gameInfo.ws.close();
      }
      if (gameInfo.keepAliveInterval) {
        clearInterval(gameInfo.keepAliveInterval);
      }
      this.activeGames.delete(gameId);
      console.log(`Stopped tracking game ${gameId}`);
    }
  }

  /**
   * Get all active games being tracked
   */
  getActiveGames() {
    return Array.from(this.activeGames.keys());
  }
}

export default new LiveGameManager();
