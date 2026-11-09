from enum import StrEnum


class Category(StrEnum):
    FOOD_DRINK = "food_drink"
    GROCERIES = "groceries"
    TRANSPORT = "transport"
    SHOPPING = "shopping"
    BILLS = "bills"
    HEALTH = "health"
    ENTERTAINMENT = "entertainment"
    TRAVEL = "travel"
    OTHER = "other"


class PaymentMethod(StrEnum):
    CARD = "card"
    CASH = "cash"
    TRANSFER = "transfer"
    MOBILE = "mobile"
    OTHER = "other"
    UNKNOWN = "unknown"


class Source(StrEnum):
    TEXT = "text"
    VOICE = "voice"
    PHOTO = "photo"


class AttachmentKind(StrEnum):
    IMAGE = "image"
    AUDIO = "audio"


class UsageKind(StrEnum):
    TEXT = "text"
    VISION = "vision"
    AUDIO = "audio"
