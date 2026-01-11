import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log('Fetching registered commands...');
  const commands = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));
  console.log(`\nFound ${commands.length} registered commands:\n`);
  commands.forEach(cmd => {
    console.log(`  - /${cmd.name}: ${cmd.description}`);
  });
} catch (error) {
  console.error('Error:', error);
}
