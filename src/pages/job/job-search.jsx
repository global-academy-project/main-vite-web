import React from 'react';

const JobSearch = () => {
  return (
    <div className="job-search-list">
      Job Search Page
      {/* Table 요소에 적용될 작업 리스트 Header */}
      <table>
        <thead>
          <tr>
            {/* 고유한 Job ID : Type Integer */}
            <td className="job-id">Job ID</td>
              <tr className="unique-id">{}</tr>
            {/* 작업 제목 : Type String */}
            <td className="job-title">Job Title</td>
              <tr className="">{}</tr>
            {/* 위치 : Type String */}
            <td className="location">Location</td>
              <tr className="location">{}</tr>
            {/* 작업 상태 : Type String */}
            <td className="status">Status</td>
              <tr className="status">{}</tr>
            {/* 담당자 : Type String */}
            <td className="assigneer">Assignee</td>
              <tr className="assigneer">{}</tr>
            {/* 생성 날짜 : Type Date */}
            <td className="created-date">Created Date</td>
              <tr className="created-date">{}</tr>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>
  );
};

export default JobSearch;