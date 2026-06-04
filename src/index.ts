import {
  createSlashCommandHandler,
  ApplicationCommand,
  InteractionHandler,
  Interaction,
  InteractionResponse,
  InteractionResponseType,
  ApplicationCommandOptionType,
} from "@glenstack/cf-workers-discord-bot";



const diceCommand: ApplicationCommand = {
  name: "roll", 
  description: "Roll (a) di(c)e.",
  options: [
    {
      name: 'dice',
      description: 'Eg: 1d20, 2d6+3, 1d20-1, d20kh (advantage), d20kl (disadvantage), 4d6kh3 (keep highest 3)',
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
    //Ensure the D is in lower case
    const lowerDice = diceInput.trim().toLowerCase();

    const inputError = (msg: string): InteractionResponse => ({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `${msg}, <@${userID}>. Try something like \`1d20\`, \`2d6+3\`, \`1d20-1\`, \`d20kh\` (advantage), \`d20kl\` (disadvantage), or \`4d6kh3\` (roll 4d6 keep highest 3).`,
        allowed_mentions: { users: [userID] },
      },
    });

    if (!lowerDice.includes('d')) {
      return inputError(`\`${diceInput.trim()}\` isn't dice notation — missing a \`d\``);
    }

    const parseResult = lowerDice.match(/^([^d]*)d([0-9]*)([a-z]+[0-9]*)?(?:([+-])([0-9]*))?$/);
    if (!parseResult) {
      return inputError(`Couldn't parse \`${diceInput.trim()}\``);
    }
    const [, rawCount, rawSides, rawSuffix, modSign, rawModifier] = parseResult;

    if (rawCount !== '' && !/^[0-9]+$/.test(rawCount)) {
      return inputError(`\`${rawCount}\` isn't a valid number of dice`);
    }
    if (rawCount !== '' && parseInt(rawCount, 10) === 0) {
      return inputError(`Can't roll 0 dice`);
    }
    if (rawCount.length > 2) {
      return inputError(`Too many dice — max is 99`);
    }
    if (!rawSides || !/^[0-9]+$/.test(rawSides)) {
      return inputError(`Missing a valid die size after the \`d\` — try \`d20\``);
    }
    if (parseInt(rawSides, 10) === 0) {
      return inputError(`A die needs at least 1 side`);
    }
    if (rawSides.length > 3) {
      return inputError(`Die size too large — max is \`d999\``);
    }
    if (modSign !== undefined) {
      if (!rawModifier || !/^[0-9]+$/.test(rawModifier)) {
        return inputError(`\`${modSign}${rawModifier || ''}\` isn't a valid modifier — try \`+5\` or \`-2\``);
      }
      if (rawModifier.length > 3) {
        return inputError(`Modifier too large — max is 999`);
      }
    }
    const suffixMatch = rawSuffix ? rawSuffix.match(/^(kh|kl)([0-9]{1,2})?$/) : null;
    if (rawSuffix && !suffixMatch) {
      return inputError(`\`${rawSuffix}\` isn't a recognized modifier — use \`kh\`/\`kl\` for advantage/disadvantage, or e.g. \`4d6kh3\` to keep highest 3`);
    }
    const keepOp = suffixMatch ? suffixMatch[1] : null;
    const keepNStr = suffixMatch ? (suffixMatch[2] || '') : '';
    const keepN = keepNStr ? parseInt(keepNStr, 10) : 0;
    const count = rawCount !== '' ? parseInt(rawCount, 10) : 1;
    if (keepOp && keepNStr && count <= 1) {
      return inputError(`\`${rawSuffix}\` needs multiple dice — e.g. \`4d6${keepOp}${keepNStr}\``);
    }
    if (keepOp && keepNStr && keepN === 0) {
      return inputError(`Must keep at least 1 die`);
    }
    if (keepOp && keepNStr && keepN >= count) {
      return inputError(`Can't keep ${keepN} of ${count} dice — the keep count must be less than the number of dice`);
    }

    const sides = parseInt(rawSides, 10);
    const modNum = modSign ? parseInt(rawModifier || '0', 10) * (modSign === '-' ? -1 : 1) : 0;
    const modDisplay = modSign ? ` ${modSign} ${rawModifier}` : '';

    if (keepOp && count <= 1) {
      const roll1 = Math.floor(Math.random() * sides) + 1;
      const roll2 = Math.floor(Math.random() * sides) + 1;
      const isAdvantage = keepOp === 'kh';
      const kept = isAdvantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
      const total = kept + modNum;
      const label = isAdvantage ? 'advantage' : 'disadvantage';

      let comparison: string;
      if (roll1 === roll2) {
        comparison = 'both the same';
      } else {
        const higher = Math.max(roll1, roll2);
        const lower = Math.min(roll1, roll2);
        comparison = isAdvantage ? `\`${higher}\` is higher` : `\`${lower}\` is lower`;
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Rolling at **${label}** for <@${userID}>: [\`${roll1}\`, \`${roll2}\`] — ${comparison}${modDisplay} → \`${total}\``,
          allowed_mentions: { users: [userID] },
        },
      };
    }

    if (keepOp && count > 1) {
      const n = keepNStr ? keepN : 1;
      const rolls: number[] = [];
      for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
      }
      const sortedDesc = [...rolls].sort((a, b) => b - a);
      const isKeepHigh = keepOp === 'kh';
      const allFormatted = sortedDesc.map((roll, i) => {
        const isKept = isKeepHigh ? i < n : i >= count - n;
        return isKept ? `\`${roll}\`` : `~~${roll}~~`;
      }).join(', ');
      const keptSum = sortedDesc
        .filter((_, i) => isKeepHigh ? i < n : i >= count - n)
        .reduce((a, b) => a + b, 0);
      const total = keptSum + modNum;
      const label = isKeepHigh ? 'highest' : 'lowest';
      const cutoffValue = isKeepHigh ? sortedDesc[n - 1] : sortedDesc[count - n];
      const hasTie = isKeepHigh
        ? n < count && sortedDesc[n] === cutoffValue
        : count - n > 0 && sortedDesc[count - n - 1] === cutoffValue;
      const tieNote = hasTie ? ` *(tie at ${cutoffValue})*` : '';

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Rolling ${count}d${sides}, keeping ${label} ${n} for <@${userID}>: [${allFormatted}]${tieNote}${modDisplay} → \`${total}\``,
          allowed_mentions: { users: [userID] },
        },
      };
    }

    if (count > 1) {
      const diceResultsArray: number[] = [];
      for (let i = 0; i < count; i++) {
        diceResultsArray[i] = Math.floor(Math.random() * sides) + 1;
      }
      const result = diceResultsArray.reduce((a, b) => a + b, 0);
      const total = result + modNum;
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Rolled a \`${total}\` for <@${userID}>. (\`${diceResultsArray.join(' + ')}\`)${modDisplay} using ${diceInput}.`,
          allowed_mentions: { users: [userID] },
        },
      };
    }

    const result = Math.floor(Math.random() * sides) + 1 + modNum;
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Rolled a \`${result}\` for <@${userID}> (${diceInput})`,
        allowed_mentions: { users: [userID] },
      },
    };
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