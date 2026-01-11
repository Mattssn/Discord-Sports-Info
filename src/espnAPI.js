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
    // ESPN changed their API - need to fetch teams and build standings from team records
    const teamsUrl = `${this.baseURL}/${sport}/${league}/teams`;
    const teamsData = await this.makeRequest(teamsUrl);
    
    if (!teamsData.sports || !teamsData.sports[0].leagues || !teamsData.sports[0].leagues[0].teams) {
      return { teams: [] };
    }
    
    const teams = teamsData.sports[0].leagues[0].teams;
    const teamsWithRecords = [];
    
    // Fetch record for each team (limit concurrent requests)
    for (const teamEntry of teams) {
      try {
        const teamId = teamEntry.team.id;
        const teamDetailUrl = `${this.baseURL}/${sport}/${league}/teams/${teamId}`;
        const teamDetail = await this.makeRequest(teamDetailUrl);
        
        if (teamDetail.team && teamDetail.team.record) {
          const totalRecord = teamDetail.team.record.items.find(r => r.type === 'total');
          if (totalRecord) {
            teamsWithRecords.push({
              team: teamDetail.team,
              record: totalRecord
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching team details: ${error.message}`);
      }
    }
    
    return { teams: teamsWithRecords };
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
    // Get upcoming games from scoreboard
    const scoreboardUrl = `${this.baseURL}/${sport}/${league}/scoreboard`;
    const scoreboard = await this.makeRequest(scoreboardUrl);
    
    if (!scoreboard.events || scoreboard.events.length === 0) {
      return { events: [] };
    }
    
    const eventsWithOdds = [];
    
    // Fetch odds for each event (limit to first 5 games)
    for (const event of scoreboard.events.slice(0, 5)) {
      try {
        const eventId = event.id;
        const competition = event.competitions[0];
        const competitionId = competition.id;
        
        // Get odds for this specific game
        const oddsUrl = `${this.coreURL}/${sport}/leagues/${league}/events/${eventId}/competitions/${competitionId}/odds`;
        const oddsData = await this.makeRequest(oddsUrl);
        
        // Attach team info and odds to event
        const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
        const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
        
        eventsWithOdds.push({
          name: event.name,
          date: event.date,
          homeTeam: homeTeam?.team,
          awayTeam: awayTeam?.team,
          odds: oddsData.items && oddsData.items.length > 0 ? oddsData.items[0] : null
        });
      } catch (error) {
        console.error(`Error fetching odds for event ${event.id}: ${error.message}`);
      }
    }
    
    return { events: eventsWithOdds };
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
   * Get stat leaders for a league
   * @param {string} sport - Sport type
   * @param {string} league - League code
   */
  async getLeaders(sport, league) {
    const url = `${this.baseURL.replace('/v2/', '/v3/')}/${sport}/${league}/leaders`;
    return await this.makeRequest(url);
  }

  /**
   * Get rankings (for college sports)
   * @param {string} sport - Sport type
   * @param {string} league - League code
   */
  async getRankings(sport, league) {
    const url = `${this.baseURL}/${sport}/${league}/rankings`;
    return await this.makeRequest(url);
  }

  /**
   * Get team schedule
   * @param {string} sport - Sport type
   * @param {string} league - League code
   * @param {string} teamId - Team ID
   */
  async getTeamSchedule(sport, league, teamId) {
    const url = `${this.baseURL}/${sport}/${league}/teams/${teamId}/schedule`;
    return await this.makeRequest(url);
  }

  /**
   * Get game summary/boxscore
   * @param {string} sport - Sport type
   * @param {string} league - League code
   * @param {string} eventId - Event ID
   */
  async getGameSummary(sport, league, eventId) {
    const url = `${this.baseURL}/${sport}/${league}/summary?event=${eventId}`;
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
    if (!data.teams || data.teams.length === 0) {
      return 'No standings data available.';
    }

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

    let message = '';

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
      message += `**${divisionName}**\n`;
      
      // Sort teams by wins (descending)
      const wins = (team) => team.record.stats.find(s => s.name === 'wins')?.value || 0;
      teams.sort((a, b) => wins(b) - wins(a));
      
      for (const teamData of teams) {
        message += `${teamData.team.displayName}: ${teamData.record.summary}\n`;
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

    for (const event of data.events) {
      if (!event.awayTeam || !event.homeTeam) {
        continue;
      }
      
      message += `**${event.awayTeam.displayName}** @ **${event.homeTeam.displayName}**\n`;

      if (event.odds) {
        message += `Spread: ${event.odds.details || 'N/A'}\n`;
        message += `Over/Under: ${event.odds.overUnder || 'N/A'}\n`;
        
        if (event.odds.awayTeamOdds?.moneyLine) {
          message += `Money Line: ${event.awayTeam.abbreviation} ${event.odds.awayTeamOdds.moneyLine > 0 ? '+' : ''}${event.odds.awayTeamOdds.moneyLine}`;
        }
        if (event.odds.homeTeamOdds?.moneyLine) {
          message += ` / ${event.homeTeam.abbreviation} ${event.odds.homeTeamOdds.moneyLine > 0 ? '+' : ''}${event.odds.homeTeamOdds.moneyLine}`;
        }
        message += '\n';
      } else {
        message += 'Odds not available\n';
      }

      message += '\n';
    }

    return message;
  }
}

export default new ESPNAPIService();
