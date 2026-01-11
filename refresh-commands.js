import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Delete all commands
try {
  console.log('Deleting all existing commands...');
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
  console.log('Successfully deleted all application commands.');
  console.log('Please restart the bot to re-register commands.');
} catch (error) {
  console.error('Error:', error);
}
