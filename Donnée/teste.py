from openaq import OpenAQ

client = OpenAQ(api_key="9348a46b8cac52f992802be731a3e1f471cf6a800c95ad7502f8d7499209d1ba")
client.locations.list(coordinates=[136.90610, 35.14942], radius=12000, limit=1000)
client.close()