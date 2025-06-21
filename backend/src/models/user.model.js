const { sequelize, Sequelize } = require("../database/connection");
const bcrypt = require("bcrypt");

const User = sequelize.define(
  "User",
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    firstName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    lastName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    // Add a virtual field for password
    password: {
      type: Sequelize.VIRTUAL,
      allowNull: true,
      set(value) {
        this.setDataValue("password", value);
        if (value) {
          this.setDataValue("passwordHash", bcrypt.hashSync(value, 10));
        }
      },
    },
    passwordHash: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    whatsappNumber: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isWhatsappVerified: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    agreeNotification: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    verificationCode: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    verified: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    verifiedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    lastLogin: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    profilePicture: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    notificationSettings: {
      type: Sequelize.JSON,
      defaultValue: {
        email: true,
        whatsapp: true,
        inApp: true,
      },
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

// Instance methods
User.prototype.validatePassword = function (password) {
  return bcrypt.compareSync(password, this.passwordHash);
};

User.prototype.generateVerificationCode = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.verificationCode = code;
  return code;
};

User.prototype.isVerificationCodeExpired = function () {
  // Verification code expires after 10 minutes
  const codeCreatedAt = this.updatedAt;
  const now = new Date();
  const diffInMinutes = (now - codeCreatedAt) / (1000 * 60);
  return diffInMinutes > 10;
};

User.prototype.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

User.prototype.toSafeJSON = function () {
  const { passwordHash, verificationCode, ...safeUser } = this.toJSON();
  return safeUser;
};

module.exports = User;
