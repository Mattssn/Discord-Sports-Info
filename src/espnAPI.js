import fetch from 'node-fetch';

/**
 * ESPN API Service
 * Handles all ESPN API requests for sports data
 */
class ESPNAPIService {
  constructor() {
    this.baseURL = 'https://site.api.espn.com/apis/site/v2/sports';
    this.coreURL = 'https://sports.core.api.espn.com/v2/sports';
    this.rateLimit = process.env.ESPN_RATE_LIMIT || 100;
    this.lastRequestTime = 0;
  }

  /**
   * Rate limiting wrapper for API requests
   */
  async makeRequest(url) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimit - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN API returned status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`ESPN API Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get live scores for a specific sport/league
   * @param {string} sport - Sport type (football, basketball, baseball, hockey, soccer)
   * @param {string} league - League code (nfl, nba, mlb, nhl, etc.)
   * @param {string} date - Optional date in YYYYMMDD format
   */
  async getScoreboard(sport, league, date = null) {
    let url = `${this.baseURL}/${sport}/${league}/scoreboard`;
    if (date) {
      url += `?dates=${date}`;
    }
    return await this.makeRequest(url);
  }

  /**
   * Get team information
   * @param {string} sport - Sport type
   * @param {string} league - League code
   */
  async getTeams(sport, league) {
    const url = `${this.baseURL}/${sport}/${league}/teams`;
    return await this.makeRequest(url);
  }

  /**
   * Get standings for a league
   * @param {string} sport - Sport type
   * @param {string} league - League code
   */
  async getStandings(sport, league) {
    const url = `${this.baseURL}/${sport}/${league}/standings`;
    return await this.makeRequest(url);
  }

  /**
   * Get team details
   * @param {string} sport - Sport type
   * @param {string} league - League code
   * @param {string} teamId - Team ID
   */
  async getTeamDetails(sport, league, teamId) {
    const url = `${this.baseURL}/${sport}/${league}/teams/${teamId}`;
    return await this.makeRequest(url);
  }

  /**
   * Get betting odds for games
   * @param {string} sport - Sport type
   * @param {string} league - League code
   */
  async getOdds(sport, league) {
    const url = `${this.coreURL}/${sport}/leagues/${league}/events`;
    const data = await this.makeRequest(url);

    // Filter events to get those with odds data
    if (data.items) {
      const eventsWithOdds = [];
      for (const item of data.items.slice(0, 10)) { // Limit to prevent too many requests
        try {
          const eventData = await this.makeRequest(item.$ref);
          if (eventData.competitions && eventData.competitions[0].odds) {
            eventsWithOdds.push(eventData);
          }
        } catch (error) {
          console.error(`Error fetching event odds: ${error.message}`);
        }
      }
      return { events: eventsWithOdds };
    }
    return data;
  }

  /**
   * Get news for a sport/league
   * @param {string} sport - Sport type
   * @param {string} league - League code
   */
  async getNews(sport, league) {
    const url = `${this.baseURL}/${sport}/${league}/news`;
    return await this.makeRequest(url);
  }

  /**
   * Format scoreboard data into a readable message
   */
  formatScoreboard(data) {
    if (!data.events || data.events.length === 0) {
      return 'No games found for this date.';
    }

    let message = `**${data.leagues[0].name} Scores**\n`;
    message += `Date: ${data.events[0].date.split('T')[0]}\n\n`;

    for (const event of data.events.slice(0, 10)) { // Limit to 10 games
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
      const awayTeam = competition.competitors.find(t => t.homeAway === 'away');

      const status = event.status.type.description;
      const detail = event.status.type.detail;

      message += `**${awayTeam.team.displayName}** ${awayTeam.score || '0'} @ `;
      message += `**${homeTeam.team.displayName}** ${homeTeam.score || '0'}\n`;
      message += `Status: ${detail}\n\n`;
    }

    return message;
  }

  /**
   * Format standings data
   */
  formatStandings(data) {
    if (!data.children || data.children.length === 0) {
      return 'No standings data available.';
    }

    let message = `**${data.name}**\n\n`;

    for (const division of data.children.slice(0, 3)) { // Limit divisions
      message += `**${division.name}**\n`;

      if (division.standings?.entries) {
        for (const entry of division.standings.entries.slice(0, 8)) { // Top 8 teams
          const team = entry.team;
          const stats = entry.stats;
          const wins = stats.find(s => s.name === 'wins')?.value || 0;
          const losses = stats.find(s => s.name === 'losses')?.value || 0;

          message += `${team.displayName}: ${wins}-${losses}\n`;
        }
      }
      message += '\n';
    }

    return message;
  }

  /**
   * Format odds data
   */
  formatOdds(data) {
    if (!data.events || data.events.length === 0) {
      return 'No betting odds available at this time.';
    }

    let message = '**Current Betting Odds**\n\n';

    for (const event of data.events.slice(0, 5)) {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
      const awayTeam = competition.competitors.find(t => t.homeAway === 'away');

      message += `**${awayTeam.team.displayName}** @ **${homeTeam.team.displayName}**\n`;

      if (competition.odds && competition.odds.length > 0) {
        const odds = competition.odds[0];
        message += `Spread: ${odds.details || 'N/A'}\n`;
        message += `Over/Under: ${odds.overUnder || 'N/A'}\n`;
      } else {
        message += 'Odds not available\n';
      }

      message += '\n';
    }

    return message;
  }
}

export default new ESPNAPIService();
