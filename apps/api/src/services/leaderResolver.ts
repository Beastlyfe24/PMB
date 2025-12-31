import { GammaApiClient } from '../lib/polymarket/gamma';
import { LeaderResolution, InputType } from '@polymarket-mirror/shared';
import pino from 'pino';

const logger = pino({ name: 'leader-resolver' });

export class LeaderResolver {
  constructor(private gammaApi: GammaApiClient) {}

  async resolveLeader(identifier: string): Promise<LeaderResolution> {
    const trimmed = identifier.trim();

    // Check if it's a wallet address (starts with 0x and is 42 chars)
    if (trimmed.startsWith('0x') && trimmed.length === 42) {
      logger.debug({ identifier: trimmed }, 'Identifier is a wallet address');

      // Try to fetch profile to confirm and get display name
      try {
        const profile = await this.gammaApi.publicProfile(trimmed);
        return {
          proxyWallet: profile.proxyWalletAddress,
          displayName: profile.username || profile.pseudonym || profile.name || null,
          inputType: InputType.WALLET,
        };
      } catch (error) {
        // If profile fetch fails, still return the wallet
        logger.warn({ error, identifier: trimmed }, 'Failed to fetch profile for wallet');
        return {
          proxyWallet: trimmed,
          displayName: null,
          inputType: InputType.WALLET,
        };
      }
    }

    // Otherwise, treat as username and search
    logger.debug({ identifier: trimmed }, 'Searching for username');

    const searchResult = await this.gammaApi.publicSearch(trimmed);

    if (!searchResult.profiles || searchResult.profiles.length === 0) {
      throw new Error(`No profile found for identifier: ${trimmed}`);
    }

    // Find best match (prefer exact username/pseudonym match)
    let bestMatch = searchResult.profiles[0];

    for (const profile of searchResult.profiles) {
      const username = (profile.username || '').toLowerCase();
      const pseudonym = (profile.pseudonym || '').toLowerCase();
      const searchTerm = trimmed.toLowerCase();

      if (username === searchTerm || pseudonym === searchTerm) {
        bestMatch = profile;
        break;
      }
    }

    logger.info(
      {
        identifier: trimmed,
        proxyWallet: bestMatch.proxyWalletAddress,
        username: bestMatch.username,
      },
      'Resolved leader'
    );

    return {
      proxyWallet: bestMatch.proxyWalletAddress,
      displayName: bestMatch.username || bestMatch.pseudonym || bestMatch.name || null,
      inputType: InputType.USERNAME,
    };
  }
}
