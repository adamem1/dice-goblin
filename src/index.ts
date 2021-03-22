import {
  createSlashCommandHandler,
  ApplicationCommand,
  InteractionHandler,
  Interaction,
  InteractionResponse,
  InteractionResponseType,
  ApplicationCommandOptionType,
} from "@glenstack/cf-workers-discord-bot";

import { Dice } from "dice-typescript";

const diceCommand: ApplicationCommand = {
  name: "roll", 
  description: "Roll (a) di(c)e.",
  options: [
    {
      name: 'dice',
      description: 'What kind of dice and how many? Eg 1d20',
      required: true,
      type: ApplicationCommandOptionType.STRING

    }
  ]
}

const diceHandler: InteractionHandler = async (
  interaction: Interaction
  ): Promise<InteractionResponse> => {
    const userID = interaction.member.user.id
    const options = interaction.data.options
    const diceInput =  options[0].value
    const dice = new Dice();
    var numDice = diceInput.match(/^[0-9]{1,2}/);
    console.log(numDice);
    console.log(typeof numDice);
// Look for multiple dice being rolled, roll them individually and display the totals
    if (numDice > 1) {
      let diceValue = diceInput.match(/d[0-9]{1,4}/)
      var diceResultsArray = []; 
      var i; 
      // This needs to print each dice value
      for (i = 0; i < numDice; i++) {
        diceResultsArray[i] = dice.roll(diceInput).total;
      }
      // Get grand total
      var result = diceResultsArray.reduce(function(a, b){
        return a + b;
      }, 0); 
      // Write individual dice rolls to a string
      var individualRollResults = diceResultsArray.join(" + ")
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `I rolled a \`${result}\` for <@${userID}> (${diceInput}) (\`${individualRollResults}\`)`,
          allowed_mentions: {
            users: [userID],
          },
        },
      }; 
      }
    else {
    const result = dice.roll(diceInput).total;
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `We rolled a \`${result}\` for <@${userID}> (${diceInput})`,
        allowed_mentions: {
          users: [userID],
        },
      },
    };
  }
  };

const slashCommandHandler = createSlashCommandHandler({
  applicationID: "810005674197123082", // @ts-ignore because vscode doesn't know about Workers Secrets
  applicationSecret: DISCORD_SECRET, 
  publicKey: "3367bb773f5b6194de5ae112c8730a1913757dfd5108a380b4d0795155947769",
  commands: [[diceCommand, diceHandler]], // Update any time you add a new command.
});

addEventListener("fetch", (event) => {
  event.respondWith(slashCommandHandler(event.request));
});