import { getInsforgeServerClient } from "@/lib/insforge-server";
import { NextRequest, NextResponse } from "next/server";


export async function GET() {
    try {
        const { insforge, userId } = await getInsforgeServerClient();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        let [ideasRes, groupsRes] = await Promise.all([
            insforge.database
                .from("ideas")
                .select("*")
                .eq("user_id", userId)
                .order("sort_order", { ascending: true })
                .order("created_at", { ascending: false }),
            insforge.database
                .from("idea_groups")
                .select("*")
                .order("created_at", { ascending: false })
        ]);

        if (groupsRes.error) {
            console.error("Error fetching groups:", groupsRes.error);
        }

        let rawGroups = groupsRes.data ?? [];
        if (rawGroups.length === 0) {
            // Seed default groups if empty
            const seedRes = await insforge.database
                .from("idea_groups")
                .insert([
                    { name: "Unassigned" },
                    { name: "To Do" },
                    { name: "In Progress" },
                    { name: "Done" }
                ])
                .select();
            if (seedRes.data && seedRes.data.length > 0) {
                rawGroups = seedRes.data;
            }
        }

        const ideas = ideasRes.data ?? [];
        const groups = rawGroups.map((group) => ({
            id: group.id,
            title: group.name,
            ideas: ideas
                .filter((idea) => idea.group_id === group.id)
                .map((idea) => ({
                    id: idea.id,
                    title: idea.title,
                    description: idea.description,
                    images: idea.images ?? [],
                    columnId: idea.group_id,
                    sortOrder: idea.sort_order
                }))
        }));

        return NextResponse.json({ groups });
    } catch (error) {
        console.error("Error fetching ideas or groups:", error);
        return NextResponse.json({ error: "Failed to fetch ideas or groups" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { insforge, userId } = await getInsforgeServerClient();
        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 401 });
        }

        const {
            id,
            title,
            groupId,
            description,
            images,
            sortOrder
        } = await request.json();

        let effectiveGroupId = groupId;
        if (!effectiveGroupId) {
            const { data: firstGroup } = await insforge.database
                .from("idea_groups")
                .select("id")
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();
            effectiveGroupId = firstGroup?.id;

            if (!effectiveGroupId) {
                const { data: newGroup } = await insforge.database
                    .from("idea_groups")
                    .insert([{ name: "Unassigned" }])
                    .select()
                    .maybeSingle();
                effectiveGroupId = newGroup?.id;
            }
        }

        if (!title || !effectiveGroupId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const payload = {
            user_id: userId,
            group_id: effectiveGroupId,
            title: title,
            description,
            images: images || [],
            sort_order: typeof sortOrder === 'number' ? sortOrder : 0
        };

        let data = null;
        let error = null;

        const isNew = !id || (typeof id === 'string' && id.startsWith('temp-'));

        if (!isNew) {
            const updateRes = await insforge.database
                .from("ideas")
                .update(payload)
                .eq("id", id)
                .eq("user_id", userId)
                .select();

            if (updateRes.error) {
                error = updateRes.error;
            } else if (updateRes.data && updateRes.data.length > 0) {
                data = updateRes.data[0];
            } else {
                // If update returned 0 rows, fallback to insert
                const insertRes = await insforge.database
                    .from("ideas")
                    .insert([payload])
                    .select();
                data = insertRes.data?.[0] || null;
                error = insertRes.error;
            }
        } else {
            const insertRes = await insforge.database
                .from("ideas")
                .insert([payload])
                .select();
            data = insertRes.data?.[0] || null;
            error = insertRes.error;
        }

        if (error) {
            console.error("Error upserting idea:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });

    } catch (error) {
        console.error("Error upserting idea:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
