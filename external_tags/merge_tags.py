import json
import os
import shutil

# 获取脚本所在的绝对路径
script_dir = os.path.dirname(os.path.abspath(__file__))
extracted_data_dir = os.path.join(script_dir, 'extracted_data')
output_file = os.path.join(script_dir, 'extra_tags.json')

# 确保extracted_data目录存在
if not os.path.exists(extracted_data_dir):
    os.makedirs(extracted_data_dir)
    print(f"已创建目录: {extracted_data_dir}")
    print("请将JSON文件放入该目录后重新运行脚本")
    exit(0)

# 合并JSON文件
print("开始合并JSON文件...")
json_files = [
    os.path.join(extracted_data_dir, f)
    for f in os.listdir(extracted_data_dir)
    if f.endswith('.json') and os.path.isfile(os.path.join(extracted_data_dir, f))
]

if not json_files:
    print(f"警告: 在 {extracted_data_dir} 中没有找到JSON文件")
    exit(0)

merged = {}

for file in json_files:
    print(f"处理文件: {file}")
    with open(file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        merged.update(data)  # 如果键重叠，后面的文件会覆盖前面的

# 保存合并结果
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"合并JSON已保存为 {output_file}")

# 复制到客户端目录
src = output_file
dst_dir = os.path.join(script_dir, '..', 'client_v3', 'public', 'data')
dst = os.path.join(dst_dir, 'extra_tags.json')

# 确保目标目录存在
os.makedirs(dst_dir, exist_ok=True)

# 复制文件
with open(src, 'rb') as fsrc:
    with open(dst, 'wb') as fdst:
        fdst.write(fsrc.read())

print(f"已复制 {src} 到 {dst}")
print("合并和复制过程已完成！") 