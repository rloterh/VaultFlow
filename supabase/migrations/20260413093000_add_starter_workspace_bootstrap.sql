CREATE OR REPLACE FUNCTION public.ensure_user_starter_workspace()
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  membership_id UUID,
  membership_role public.user_role,
  created_workspace BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  existing_membership public.org_memberships%ROWTYPE;
  source_profile public.profiles%ROWTYPE;
  workspace_name TEXT;
  base_slug TEXT;
  candidate_slug TEXT;
  created_org public.organizations%ROWTYPE;
  created_membership public.org_memberships%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO existing_membership
  FROM public.org_memberships
  WHERE user_id = current_user_id
    AND is_active = TRUE
  ORDER BY joined_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      organization.id,
      organization.name,
      organization.slug,
      existing_membership.id,
      existing_membership.role,
      FALSE
    FROM public.organizations AS organization
    WHERE organization.id = existing_membership.org_id;
    RETURN;
  END IF;

  SELECT *
  INTO source_profile
  FROM public.profiles
  WHERE id = current_user_id;

  workspace_name := COALESCE(NULLIF(source_profile.full_name, ''), split_part(source_profile.email, '@', 1), 'VaultFlow') || ' Workspace';
  base_slug := left(
    regexp_replace(lower(workspace_name), '[^a-z0-9]+', '-', 'g'),
    42
  );
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');

  IF base_slug = '' THEN
    base_slug := 'vaultflow-workspace';
  END IF;

  candidate_slug := base_slug;

  WHILE EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE slug = candidate_slug
  ) LOOP
    candidate_slug := left(base_slug, 36) || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 6);
  END LOOP;

  INSERT INTO public.organizations (name, slug)
  VALUES (workspace_name, candidate_slug)
  RETURNING *
  INTO created_org;

  INSERT INTO public.org_memberships (user_id, org_id, role, is_active)
  VALUES (current_user_id, created_org.id, 'owner', TRUE)
  RETURNING *
  INTO created_membership;

  RETURN QUERY
  SELECT
    created_org.id,
    created_org.name,
    created_org.slug,
    created_membership.id,
    created_membership.role,
    TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_starter_workspace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_starter_workspace() TO authenticated;
