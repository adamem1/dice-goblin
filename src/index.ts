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
import { stripIgnoredCharacters } from "graphql-compose/lib/graphql";

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
    //Ensure the D is in lower case
    const lowerDice = diceInput.toLowerCase();

    // Test input to make sure we understand the format. 

    const regexDice = new RegExp(/^([0-9]{0,2}d[0-9]{1,3}[a-z]{0,2})(\+[0-9]{0,2})?$/);
    if (!lowerDice.match(regexDice)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Not sure what you're talking about, <@${userID}>.`,
          allowed_mentions: {
            users: [userID],
          },
        },
      }
    }

    // Parse the number of dice (numDice) and what kind of dice (diceValue)
    var numDice = lowerDice.match(/^[0-9]{1,2}/);
    const diceValue = lowerDice.match(/d[0-9]{1,4}/);
    // We have to append 1 to diceValue for the for loop to work. 
    const one = '1';
    if (lowerDice.includes("+")){
      var split_dice = lowerDice.split('+');
      modifier = split_dice[1];
    } else {
     var modifier = '0'
    }
    var newdiceValue = one.concat(diceValue)
    // Also removing the console log seems to break. I don't know why. 
    console.log(diceValue)
    // Look for multiple dice being rolled, roll them individually and display the totals
    if (numDice > 1) {
      var diceResultsArray = []; 
      var i; 
      for (i = 0; i < numDice; i++) {
        diceResultsArray[i] = dice.roll(newdiceValue).total;
      }
      // Get roll total
      var result = diceResultsArray.reduce(function(a, b){
        return a + b;
      }, 0); 
      // Get grand total
      var grand_total = Number(result) + Number(modifier);
      // Write individual dice rolls to a string
      var individualRollResults = diceResultsArray.join(" + ")
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Rolled a \`${grand_total}\` for <@${userID}>. (\`${individualRollResults}\`) \+ ${modifier} using ${diceInput}. `,
          allowed_mentions: {
            users: [userID],
          },
        },
      }; 
      }
    else {
    const result = dice.roll(lowerDice).total;
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Rolled a \`${result}\` for <@${userID}> (${diceInput})`,
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