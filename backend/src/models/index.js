const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 100]
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [6, 255]
    }
  },
  whatsappNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      is: /^(\+62|62|0)8[1-9][0-9]{6,11}$/
    }
  },
  isWhatsappVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  profilePicture: {
    type: DataTypes.STRING
  },
  notificationSettings: {
    type: DataTypes.JSON,
    defaultValue: {
      matchFound: true,
      claimReceived: true,
      claimStatusChanged: true,
      systemUpdates: false
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['whatsappNumber'] },
    { fields: ['isActive'] }
  ]
});

// Lost Item Model
const LostItem = sequelize.define('LostItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  itemName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM(
      'Dompet/Tas', 'Elektronik', 'Kendaraan', 'Aksesoris', 
      'Dokumen', 'Alat Tulis', 'Pakaian', 'Lainnya'
    ),
    allowNull: false
  },
  lastSeenLocation: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateLost: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  reward: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM('active', 'has_matches', 'resolved', 'expired'),
    defaultValue: 'active'
  },
  aiProcessed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastMatchedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'lost_items',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['dateLost'] },
    { fields: ['aiProcessed'] }
  ]
});

// Found Item Model
const FoundItem = sequelize.define('FoundItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  itemName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM(
      'Dompet/Tas', 'Elektronik', 'Kendaraan', 'Aksesoris', 
      'Dokumen', 'Alat Tulis', 'Pakaian', 'Lainnya'
    ),
    allowNull: false
  },
  locationFound: {
    type: DataTypes.STRING,
    allowNull: false
  },
  foundDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  foundTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  images: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  status: {
    type: DataTypes.ENUM('available', 'pending_claim', 'claimed', 'expired'),
    defaultValue: 'available'
  },
  aiProcessed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastMatchedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'found_items',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['foundDate'] },
    { fields: ['aiProcessed'] }
  ]
});

// Claim Model
const Claim = sequelize.define('Claim', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  story: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [10, 1000]
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  reviewedAt: {
    type: DataTypes.DATE
  },
  rejectionReason: {
    type: DataTypes.TEXT
  },
  handoverDetails: {
    type: DataTypes.JSON
  }
}, {
  tableName: 'claims',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

// Match Model
const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  similarity: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0,
      max: 1
    }
  },
  matchType: {
    type: DataTypes.ENUM(
      'image', 'text_clip', 'text_semantic', 'cross_modal', 
      'hybrid', 'strong_image', 'weak_match'
    ),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'claimed', 'expired'),
    defaultValue: 'pending'
  },
  detectedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  notificationSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'matches',
  timestamps: true,
  indexes: [
    { fields: ['similarity'] },
    { fields: ['status'] },
    { fields: ['detectedAt'] },
    { fields: ['notificationSent'] }
  ]
});

// Notification Model
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM(
      'match_found', 'claim_received', 'claim_approved', 
      'claim_rejected', 'system_update'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  data: {
    type: DataTypes.JSON
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  whatsappSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  whatsappSentAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['isRead'] },
    { fields: ['whatsappSent'] },
    { fields: ['createdAt'] }
  ]
});

// Define Associations
// User associations
User.hasMany(LostItem, { foreignKey: 'userId', as: 'lostItems' });
User.hasMany(FoundItem, { foreignKey: 'userId', as: 'foundItems' });
User.hasMany(Claim, { foreignKey: 'claimerId', as: 'claims' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// LostItem associations
LostItem.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
LostItem.hasMany(Match, { foreignKey: 'lostItemId', as: 'matches' });

// FoundItem associations
FoundItem.belongsTo(User, { foreignKey: 'userId', as: 'finder' });
FoundItem.hasMany(Match, { foreignKey: 'foundItemId', as: 'matches' });
FoundItem.hasMany(Claim, { foreignKey: 'foundItemId', as: 'claims' });

// Claim associations
Claim.belongsTo(User, { foreignKey: 'claimerId', as: 'claimer' });
Claim.belongsTo(FoundItem, { foreignKey: 'foundItemId', as: 'foundItem' });
Claim.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });

// Match associations
Match.belongsTo(LostItem, { foreignKey: 'lostItemId', as: 'lostItem' });
Match.belongsTo(FoundItem, { foreignKey: 'foundItemId', as: 'foundItem' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  User,
  LostItem,
  FoundItem,
  Claim,
  Match,
  Notification,
  sequelize
};