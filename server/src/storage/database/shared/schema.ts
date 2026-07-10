import { pgTable, serial, timestamp, varchar, boolean, numeric, text, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


// 系统表（禁止删除）
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表
export const users = pgTable(
	"users",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		openid: varchar("openid", { length: 64 }).notNull().unique(),
		nickname: varchar("nickname", { length: 100 }),
		avatar_url: varchar("avatar_url", { length: 500 }),
		is_admin: boolean("is_admin").default(false).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("users_openid_idx").on(table.openid),
		index("users_is_admin_idx").on(table.is_admin),
	]
);

// 管理员配置表
export const adminConfig = pgTable(
	"admin_config",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
		role: varchar("role", { length: 20 }).default("admin").notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("admin_config_user_id_idx").on(table.user_id),
		index("admin_config_role_idx").on(table.role),
	]
);

// 参数配置表（素材生成参数）
export const generationParams = pgTable(
	"generation_params",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		param_name: varchar("param_name", { length: 50 }).notNull().unique(),
		param_value: numeric("param_value", { precision: 10, scale: 2 }),
		param_min: numeric("param_min", { precision: 10, scale: 2 }),
		param_max: numeric("param_max", { precision: 10, scale: 2 }),
		param_unit: varchar("param_unit", { length: 20 }),
		description: text("description"),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("generation_params_param_name_idx").on(table.param_name),
		index("generation_params_is_active_idx").on(table.is_active),
	]
);

// 生成的图片素材表
export const generatedImages = pgTable(
	"generated_images",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
		title: varchar("title", { length: 200 }),
		description: text("description"),
		prompt: text("prompt"),              // 用户原始需求
		positive_prompt: text("positive_prompt"),  // 正向绘图提示词
		negative_prompt: text("negative_prompt"),  // 逆向绘图提示词
		image_url: varchar("image_url", { length: 500 }),  // TOS 图片 URL
		status: varchar("status", { length: 20 }).default("pending").notNull(),  // pending/compliant/rejected
		compliance_note: text("compliance_note"),  // 合规检查备注
		is_favorite: boolean("is_favorite").default(false).notNull(),  // 是否收藏
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("generated_images_user_id_idx").on(table.user_id),
		index("generated_images_status_idx").on(table.status),
		index("generated_images_created_at_idx").on(table.created_at),
		index("generated_images_is_favorite_idx").on(table.is_favorite),
	]
);