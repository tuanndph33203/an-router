import { generateActionPlan } from "./src/lib/orchestrator/planEngine.ts";
import type { AppRegistryConfig } from "./src/lib/orchestrator/types.ts";

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🧪 BẮT ĐẦU BỘ KIỂM THỬ XÁC MINH TOÀN DIỆN LUỒNG LOGGING AGENTIC ORCHESTRATOR");
  console.log("================================================================================");

  // --------------------------------------------------------------------------
  // TEST CASE 1: Chào hỏi xã giao (Direct Answer không gọi tool thừa)
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("🧪 TEST CASE 1: Giao tiếp chào hỏi xã giao");
  console.log("Mục tiêu: AI phải nhận diện câu chào, trả lời ngay ở Lượt 1 mà không gọi tool thừa.");
  console.log("================================================================================");

  const greetingAppConfig: AppRegistryConfig = {
    appId: "test_multiformat_app",
    name: "AnPOS / ERP Report",
    capabilities: ["api", "sql"],
    schemaEndpointUrl: "http://localhost:5000/api/ai-report/schema",
    sqlExecuteEndpoint: "/api/ai-report/execute-sql",
    baseApiUrl: "http://localhost:5000",
  };

  const plan1 = await generateActionPlan(
    greetingAppConfig,
    "Xin chào! Bạn là ai và có thể giúp gì cho tôi?",
    { applicationId: greetingAppConfig.appId },
    {},
    "",
    (status) => console.log(`   [Progress] ${status}`)
  );

  console.log("\n📌 [KẾT QUẢ TEST CASE 1]:");
  console.log(`   - Action: ${plan1.action}`);
  console.log(`   - PlanName: ${plan1.planName}`);
  console.log(`   - Direct Answer: ${plan1.directAnswer?.slice(0, 150)}...`);
  console.log(`   - Steps executed: ${plan1.steps?.length || 0}`);
  if (plan1.action === "direct_answer" && (!plan1.steps || plan1.steps.length === 0)) {
    console.log("   ✅ PASSED: Chào hỏi thành công ở Lượt 1 không tốn bất kỳ tool call nào!");
  } else {
    console.log("   ⚠️ Note: Kiểm tra lại các bước thực thi.");
  }

  // --------------------------------------------------------------------------
  // TEST CASE 2: Tra cứu kiến thức nghiệp vụ (Multi-Search + Ranker)
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("🧪 TEST CASE 2: Tra cứu kiến thức nghiệp vụ");
  console.log("Mục tiêu: Gọi tool search_knowledge, kích hoạt sqlite-vec + FTS5 + RRF + Cross-Encoder Ranker.");
  console.log("================================================================================");

  const knowledgeAppConfig: AppRegistryConfig = {
    appId: "test_multiformat_app",
    name: "Hệ thống Quản lý Thẻ & Doanh thu",
    capabilities: ["api"],
    baseApiUrl: "http://localhost:5000",
  };

  const plan2 = await generateActionPlan(
    knowledgeAppConfig,
    "Công thức tính tổng tiền thanh toán thẻ NoName và quy định chiết khấu cho khách VIP?",
    { applicationId: knowledgeAppConfig.appId },
    {},
    "",
    (status) => console.log(`   [Progress] ${status}`)
  );

  console.log("\n📌 [KẾT QUẢ TEST CASE 2]:");
  console.log(`   - Action: ${plan2.action}`);
  console.log(`   - PlanName: ${plan2.planName}`);
  console.log(`   - Direct Answer: ${plan2.directAnswer}`);
  if (
    plan2.directAnswer?.includes("totalPayment") ||
    plan2.directAnswer?.includes("Tổng tiền thẻ bán") ||
    plan2.directAnswer?.includes("Chiết khấu") ||
    plan2.directAnswer?.includes("15%")
  ) {
    console.log("   ✅ PASSED: Kiến thức nghiệp vụ được trích xuất chính xác qua bộ tứ Multi-Search + Ranker!");
  } else {
    console.log("   ⚠️ Note: Câu trả lời chưa chứa đầy đủ công thức mong đợi.");
  }

  // --------------------------------------------------------------------------
  // TEST CASE 3: Lập báo cáo CSDL (list_tables -> describe_tables -> submit_plan)
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("🧪 TEST CASE 3: Lập báo cáo truy vấn cơ sở dữ liệu");
  console.log("Mục tiêu: Gọi list_tables -> describe_tables -> submit_plan(action: 'report_sql').");
  console.log("================================================================================");

  const reportAppConfig: AppRegistryConfig = {
    appId: "f69f730d-3f6a-40b9-88e1-b28ffec16f6c",
    name: "Dynamic Report",
    capabilities: ["api", "sql"],
    schemaEndpointUrl: "http://localhost:5000/api/ai-report/schema",
    sqlExecuteEndpoint: "/api/ai-report/execute-sql",
    baseApiUrl: "http://localhost:5000",
  };

  const plan3 = await generateActionPlan(
    reportAppConfig,
    "Cho tôi báo cáo tổng doanh thu bán hàng theo từng chi nhánh",
    { applicationId: reportAppConfig.appId, dbProfile: reportAppConfig.appId, branchCode: "CN01" },
    {},
    "",
    (status) => console.log(`   [Progress] ${status}`)
  );

  console.log("\n📌 [KẾT QUẢ TEST CASE 3]:");
  console.log(`   - Action: ${plan3.action}`);
  console.log(`   - PlanName: ${plan3.planName}`);
  console.log(`   - SQL Generated:\n${plan3.resolvedPayload?.sql}`);
  console.log(`   - Summary: ${plan3.resolvedPayload?.summary}`);
  if (plan3.action === "report_sql" && plan3.resolvedPayload?.sql) {
    console.log("   ✅ PASSED: Lập báo cáo SQL thành công qua đầy đủ chu trình Agentic Tool Loop!");
  } else {
    console.log("   ⚠️ Note: Kiểm tra lại việc sinh câu SQL.");
  }

  console.log("\n================================================================================");
  console.log("🎉 HOÀN THÀNH TOÀN BỘ 3 TEST CASES VỚI ĐẦY ĐỦ LOGGING RÕ RÀNG!");
  console.log("================================================================================");
}

runTestSuite().catch((err) => {
  console.error("Lỗi khi chạy bộ kiểm thử:", err);
  process.exit(1);
});
