/**
 * Transient guild invites (invitee display name → pending invite). Latest
 * invite wins; consumed on accept; lost on restart (guilds themselves are
 * durable). Process-local like the other social seams.
 */
export interface GuildInvite {
  guildId: string;
  guildName: string;
  inviterName: string;
}

const invites = new Map<string, GuildInvite>();

const key = (name: string): string => name.trim().toLowerCase();

export const guildInvites = {
  set(invitee: string, invite: GuildInvite): void {
    invites.set(key(invitee), invite);
  },
  get(invitee: string): GuildInvite | undefined {
    return invites.get(key(invitee));
  },
  consume(invitee: string): GuildInvite | undefined {
    const inv = invites.get(key(invitee));
    invites.delete(key(invitee));
    return inv;
  },
};
