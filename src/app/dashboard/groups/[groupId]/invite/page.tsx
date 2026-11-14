import { redirect } from 'next/navigation'

/**
 * Legacy e-mail invitation route. It tried to add the visitor to the group with a direct
 * `group_members` insert (which always reported success without adding anyone, and is now blocked
 * by row-level security). Membership only changes through the `accept_group_invitation` function,
 * reached from /invite/accept, so this route just returns people to the group.
 */
export default async function LegacyInvitePage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  redirect(`/dashboard/groups/${encodeURIComponent(groupId)}`)
}
