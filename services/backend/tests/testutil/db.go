package testutil

import (
	"testing"

	"dev.azure.com/carbyte/Carbyte-Academy/_git/Carbyte-Academy-Backend/internal/model"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// SetupTestDB creates an in-memory SQLite database for testing
func SetupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	// Migrate the schema
	err = db.AutoMigrate(&model.LearningPath{}, &model.Skill{}, &model.LPSkill{})
	require.NoError(t, err)

	return db
}

// SetupTestDBWithUniqueIndex creates a test DB with unique constraint on diagram_id
func SetupTestDBWithUniqueIndex(t *testing.T) *gorm.DB {
	db := SetupTestDB(t)
	// Create unique index on diagram_id for testing constraint violations
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_diagram_id ON learning_paths(diagram_id)")
	return db
}
