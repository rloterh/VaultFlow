CREATE OR REPLACE FUNCTION public.is_active_member_of_org(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships AS membership
    WHERE membership.org_id = target_org_id
      AND membership.user_id = auth.uid()
      AND membership.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(
  target_org_id UUID,
  allowed_roles public.user_role[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships AS membership
    WHERE membership.org_id = target_org_id
      AND membership.user_id = auth.uid()
      AND membership.role = ANY (allowed_roles)
      AND membership.is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_member_of_org(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_member_of_org(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.has_org_role(UUID, public.user_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, public.user_role[]) TO authenticated;

DROP POLICY IF EXISTS "Org members can view org" ON public.organizations;
CREATE POLICY "Org members can view org"
  ON public.organizations FOR SELECT
  USING (public.is_active_member_of_org(id));

DROP POLICY IF EXISTS "Admins can update org" ON public.organizations;
CREATE POLICY "Admins can update org"
  ON public.organizations FOR UPDATE
  USING (public.has_org_role(id, ARRAY['owner', 'admin']::public.user_role[]))
  WITH CHECK (public.has_org_role(id, ARRAY['owner', 'admin']::public.user_role[]));

DROP POLICY IF EXISTS "Members can view org memberships" ON public.org_memberships;
CREATE POLICY "Members can view org memberships"
  ON public.org_memberships FOR SELECT
  USING (public.is_active_member_of_org(org_id));

DROP POLICY IF EXISTS "Admins can manage memberships" ON public.org_memberships;
CREATE POLICY "Admins can manage memberships"
  ON public.org_memberships FOR ALL
  USING (public.has_org_role(org_id, ARRAY['owner', 'admin']::public.user_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner', 'admin']::public.user_role[]));

DROP POLICY IF EXISTS "Admins can manage invites" ON public.org_invites;
CREATE POLICY "Admins can manage invites"
  ON public.org_invites FOR ALL
  USING (public.has_org_role(org_id, ARRAY['owner', 'admin']::public.user_role[]))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner', 'admin']::public.user_role[]));
