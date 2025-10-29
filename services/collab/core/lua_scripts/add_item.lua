local list_key = KEYS[1]
local item_id = ARGV[1]
local item_data = ARGV[2]

local time_parts = redis.call('TIME')
local new_rev = tonumber(time_parts[1]) + tonumber(time_parts[2]) / 1000000

local items_json = redis.call('HGET', list_key, 'items')
local items = {}
if items_json then items = cjson.decode(items_json) end

items[item_id] = cjson.decode(item_data)

redis.call('HSET', list_key, 'rev', new_rev, 'items', cjson.encode(items),
           'updated_at', time_parts[1])

local list_id = string.match(list_key, 'todo:state:(.+)')
local message = cjson.encode({
    type = 'item_added',
    list_id = list_id,
    item = cjson.decode(item_data),
    rev = new_rev
})
redis.call('PUBLISH', 'todo:updates', message)

return tostring(new_rev)
