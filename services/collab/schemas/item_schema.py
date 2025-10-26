from pydantic import BaseModel, ConfigDict, Field
from utils.constants import Regex


class AddItemSchema(BaseModel):
    """Schema for adding a new item"""

    list_id: str = Field(..., min_length=1, description="ID of the list")
    name: str = Field(..., min_length=1, max_length=255, description="Item name")
    description: str | None = Field(
        None, max_length=2000, description="Item description"
    )
    status: str = Field(default='not_started', pattern=Regex.STATUS_REGEX)
    done: bool = Field(default=False)
    due_date: str | None = Field(None, description="ISO date string")
    media_url: str | None = Field(None, description="URL to attached media")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "list_id": "list-123",
                "name": "Buy milk",
                "description": "Get 2% milk from store",
                "status": "not_started",
                "done": False,
                "due_date": "2025-01-30",
                "media_url": "https://example.com/image.jpg",
            }
        }
    )


class UpdateItemSchema(BaseModel):
    """Schema for updating a todo item"""

    list_id: str = Field(..., min_length=1, description="ID of the list")
    item_id: str = Field(
        ...,
        min_length=1,
        description='ID of the todo item. Notice this field is named "id" in Supabase',
    )
    name: str | None = Field(None, max_length=500, description='Item name')
    description: str | None = Field(
        None, max_length=2000, description='Item description'
    )
    status: str | None = Field(
        None,
        pattern=Regex.STATUS_REGEX,
        description='Item status',
    )
    done: bool | None = Field(None, description='Item completion flag')
    due_date: str | None = Field(None, description='ISO due date string')
    media_url: str | None = Field(None, description='URL to attached media')
    rev: float | None = Field(..., description='Redis timestamp based revision number')

    model_config = ConfigDict(
        json_schema_extra={
            'example': {
                'list_id': 'list-123',
                'item_id': 'item-456',
                'description': 'new description',
                'rev': 1730484792.123456,
            }
        }
    )


class DeleteItemSchema(BaseModel):
    """Schema for deleting a todo item"""

    list_id: str = Field(..., min_length=1, description="ID of the list")
    item_id: str = Field(
        ...,
        min_length=1,
        description='ID of the todo item. Notice this field is named "id" in Supabase',
    )
