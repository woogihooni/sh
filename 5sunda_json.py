import pandas as pd
import json
import csv
import numpy as np
import re
import os

def convert_csv_to_json(csv_filename, json_filename):
    """
    CSV 파일을 읽어 단답형, 4지선다, 5지선다형 문제를 포함한
    문제 데이터셋을 JSON 파일로 변환하는 함수입니다.
    """
    # 이미지 파일이 저장될 기본 디렉토리
    image_base_dir = "images"
    # image_base_dir이 없으면 생성
    if not os.path.exists(image_base_dir):
        os.makedirs(image_base_dir)

    problem_line_content = None
    error_line_number = -1

    try:
        # csv 모듈로 먼저 파일의 필드 개수 오류를 찾습니다.
        with open(csv_filename, 'r', encoding='utf-8', newline='') as f:
            reader = csv.reader(f)
            headers = next(reader)
            # 헤더의 총 필드 개수를 기준으로 데이터 줄을 검증합니다.
            expected_field_count = len(headers)
            for i, row in enumerate(reader):
                current_line_number = i + 2
                if len(row) != expected_field_count:
                    error_line_number = current_line_number
                    problem_line_content = ','.join(row)
                    print(f"오류: {current_line_number}번째 줄에서 필드 개수 불일치 발생.")
                    print(f"예상 필드 개수: {expected_field_count}, 실제: {len(row)}")
                    print(f"문제의 줄 내용 (파싱 후): '{problem_line_content}'")
                    return
        
        # 필드 개수 오류가 없었다면 pandas로 데이터 처리
        df = pd.read_csv(csv_filename, encoding='utf-8', skipinitialspace=True)

        # 컬럼 이름 정규화: 앞뒤 공백 제거 및 내부 공백 제거
        df.columns = [re.sub(r'\s+', '', col.strip()) for col in df.columns]

        # DataFrame 전체의 NaN 값을 Python의 None으로 명시적으로 변환
        df = df.replace({np.nan: None})

        # '연월일' 및 '문제번호' 컬럼을 문자열로 변환
        if '연월일' in df.columns:
            df['연월일'] = df['연월일'].astype(str)
        if '문제번호' in df.columns:
            df['문제번호'] = df['문제번호'].astype(str)
        # ⭐ 수정된 부분: '정답' 컬럼의 값을 문자열로 변환합니다.
        if '정답' in df.columns:
            df['정답'] = df['정답'].astype(str)


        # '보기', '문제내용', '해설' 필드의 쉼표를 언더바로 변환
        cols_to_process = ['보기', '문제내용', '해설']
        for col in cols_to_process:
            if col in df.columns:
                df[col] = df[col].apply(lambda x: str(x).replace(',', '_') if x is not None else None)

        # 이미지 경로 변환 및 선택지 쉼표 변환 로직
        option_cols = [col for col in df.columns if col.startswith('선택지')]
        
        for index, row in df.iterrows():
            round_date = row.get('연월일')
            question_num = row.get('문제번호')

            # '보기' 필드 이미지 경로 처리
            if '보기' in row and row['보기'] is not None and str(row['보기']).strip().lower() == 'image':
                if round_date and question_num and str(round_date).lower() != 'nan' and str(question_num).lower() != 'nan':
                    df.at[index, '보기'] = f"{image_base_dir}/{round_date}-{question_num}-view.png"
                else:
                    print(f"경고: {index+2}행 '보기'는 'image'이나_ '연월일'('{round_date}') 또는 '문제번호'('{question_num}')가 유효하지 않아 경로 생성 불가.")

            # 선택지 필드 이미지 경로 및 쉼표 처리
            for option_key in option_cols:
                if option_key in row and row[option_key] is not None:
                    option_text = str(row[option_key])
                    
                    if option_text.strip().lower() == 'image':
                        # 이미지 경로 생성
                        if round_date and question_num and str(round_date).lower() != 'nan' and str(question_num).lower() != 'nan':
                            option_num = re.search(r'\d+', option_key).group(0) if re.search(r'\d+', option_key) else '0'
                            df.at[index, option_key] = f"{image_base_dir}/{round_date}-{question_num}-{option_num}.png"
                        else:
                            print(f"경고: {index+2}행 '{option_key}'는 'image'이나_ '연월일'('{round_date}') 또는 '문제번호'('{question_num}')가 유효하지 않아 경로 생성 불가.")
                    else:
                        # 쉼표를 언더바로 변환
                        df.at[index, option_key] = option_text.replace(',', '_')

        # DataFrame을 JSON 형식에 맞는 리스트 오브 딕셔너리로 변환
        quiz_data_list = df.to_dict(orient='records')

        # JSON 파일로 저장
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(quiz_data_list, f, ensure_ascii=False, indent=4)

        print(f"'{csv_filename}'가 성공적으로 '{json_filename}'으로 변환되었습니다.")
        print(f"이미지 경로는 '{image_base_dir}/' 폴더를 기준으로 생성되었습니다.")

    except FileNotFoundError:
        print(f"오류: '{csv_filename}' 파일을 찾을 수 없습니다.")
    except Exception as e:
        print(f"변환 중 알 수 없는 오류 발생: {e}")
        if error_line_number != -1:
            print(f"이전에 확인된 문제의 줄 번호: {error_line_number}")
            print(f"이전에 확인된 문제의 줄 내용: '{problem_line_content}'")
        print("CSV 파일의 구조나 인코딩에 문제가 있을 수 있습니다.")
        print("예: 필드 내 콤마(,)가 있을 경우 필드 전체를 '로 감싸야 합니다.")

if __name__ == "__main__":
    convert_csv_to_json(csv_filename="e:/업무폴더/개인자료/준비/5지선다/quiz_data.csv",
                        json_filename="e:/업무폴더/개인자료/준비/5지선다/quiz_data.json")

    # python -m http.server 8000
    # http://localhost:8000/index.html