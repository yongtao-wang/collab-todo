local list_key = KEYS[1]
local item_id = ARGV[1]
local item_data = ARGV[2]

local time_parts = redis.call('TIME')
local new_rev = tonumber(time_parts[1]) + tonumber(time_parts[2]) / 1000000

local items_json = redis.call('HGET', list_key, 'items')
if not items_json then return redis.error_reply('List not found') end

local items = cjson.decode(items_json)
if not items[item_id] then return redis.error_reply('Item not found') end

items[item_id] = cjson.decode(item_data)

redis.call('HSET', list_key, 'rev', new_rev, 'items', cjson.encode(items),
           'updated_at', time_parts[1])

local list_id = string.match(list_key, 'todo:state:(.+)')
local message = cjson.encode({
    type = 'item_updated',
    list_id = list_id,
    item = cjson.decode(item_data),
    rev = new_rev
})
redis.call('PUBLISH', 'todo:updates', message)

return tostring(new_rev)
