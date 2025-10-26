from pydantic import BaseModel, Field
from utils.constants import Regex


class JoinListSchema(BaseModel):
    """Schema for joining a list room"""

    list_id: str = Field(..., min_length=1, description='ID of the list')


class CreateListSchema(BaseModel):
    """Schema for creating a new list"""

    list_name: str | None = Field(None, min_length=1, description='Name of the list')
    user_id: str | None = Field(..., min_length=1, description='ID of user creating')


class ShareListSchema(BaseModel):
    """Schema for sharing a list"""

    list_id: str = Field(..., min_length=1, description='ID of the list to be shared')
    owner_user_id: str = Field(
        ..., min_length=1, description='ID of the user sharing the list'
    )
    shared_user_id: str = Field(
        ..., min_length=1, description='ID of the user to be shared to'
    )
    role: str = Field(
        ..., pattern=Regex.ROLE_REGEX, description='The role to be shared as'
    )
